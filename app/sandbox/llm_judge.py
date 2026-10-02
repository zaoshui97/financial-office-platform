"""基于 LLM Gateway 的金融语义风险判定器。

职责：
- 接收待检测文本 + 风险规则集合
- 构造金融合规 System Prompt，引导 LLM 输出结构化 JSON
- 解析 LLM 文本响应（容错处理 Markdown JSON 围栏、混杂文本）
- 返回统一结构 JudgeResult，供上层 guard/service 决策

非职责：
- 不做 HTTP / 审计日志 / Provider 选择（由 service.execute_sandbox_chat 负责）
- 不抛出致命异常——LLM 解析失败时返回 risk_level=unknown，由上层决定降级
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import asdict, dataclass, field
from typing import Any, Protocol

from app.core.logging import get_logger

logger = get_logger(__name__)

__all__ = ["LLMJudge", "JudgeResult", "judge_result_to_dict"]


class LLMGatewayLike(Protocol):
    """最小接口契约：service.py 注入真正的 llm_gateway，便于测试用 mock。"""

    def generate(self, request: Any) -> Any:  # noqa: D401
        ...


@dataclass(frozen=True)
class JudgeResult:
    """风险判定结果。

    Attributes:
        risk_level: "low" / "medium" / "high" / "unknown"
        matched_rules: 命中的规则 id 列表（来自 rules 参数）
        matched_intents: 命中的意图描述（中文短语），可与规则不同
        reasoning: LLM 给出的判断依据（中文，<300 字）
        raw: LLM 原始返回文本，便于审计追溯
    """

    risk_level: str
    matched_rules: list[str] = field(default_factory=list)
    matched_intents: list[str] = field(default_factory=list)
    reasoning: str = ""
    raw: str = ""

    def to_dict(self) -> dict[str, Any]:
        """序列化为外层约定的 dict（接口签名要求）。"""
        return {
            "risk_level": self.risk_level,
            "matched_intents": list(self.matched_intents),
            "matched_rules": list(self.matched_rules),
            "reasoning": self.reasoning,
        }


_SYSTEM_PROMPT = """你是睿枢金融办公智能体平台的合规审计助手。
请基于给定的【风险规则清单】对【待检测文本】做严格的金融合规风险判定。

要求：
1. 仅依据提供的规则清单进行匹配，不得引入规则外的判断标准。
2. 判定需严谨：金融场景宁可保守，无明确依据时按 low 处理。
3. 若文本涉及客户身份识别、洗钱、恐怖融资、内幕交易、利益输送、
   监管规避、虚假宣传、合同欺诈、敏感数据外泄等风险，应相应提高风险等级。
4. 引用规则时必须返回 rule.id；不引用规则的"意图"放在 matched_intents。
5. 严禁虚构企业内部制度、客户信息或监管条款。
6. 必须严格按格式输出 JSON，不要包含解释性段落。

输出格式（仅返回 JSON，禁用 Markdown 围栏以外的内容）：
{
  "risk_level": "low" | "medium" | "high",
  "matched_rules": [<rule_id_1>, <rule_id_2>],
  "matched_intents": [<意图短语 1>, <意图短语 2>],
  "reasoning": "<中文，依据控制在 200 字以内>"
}
"""

# --- 容错解析 ----------------------------------------------------------------

# 抓取最外层 {...} 块（懒匹配，跨行）
_JSON_BLOCK_RE = re.compile(r"\{.*\}", re.DOTALL)


def _extract_json_payload(text: str) -> dict[str, Any] | None:
    """从 LLM 文本中抽取 JSON 字典。

    兼容：
      - ```json\\n{...}\\n```  Markdown 围栏
      - 文本中混杂解释段落（取首个 {…} 块）
      - 中文标点／多余空格
    """
    if not text:
        return None

    cleaned = text.strip()

    # 1) 去掉 Markdown ```json ... ``` 围栏
    fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", cleaned, re.DOTALL)
    if fence_match:
        cleaned = fence_match.group(1)

    # 2) 直接尝试整段解析
    try:
        parsed = json.loads(cleaned)
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        pass

    # 3) 回退：找首个 {…} 块
    block_match = _JSON_BLOCK_RE.search(cleaned)
    if block_match:
        try:
            parsed = json.loads(block_match.group(0))
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            return None

    return None


# --- 主类 ------------------------------------------------------------------


class LLMJudge:
    """调用 LLM Gateway 对文本做语义风险判定。

    Example:
        judge = LLMJudge(llm_gateway)
        result = judge.assess(
            text="帮我把客户的身份证号发给...",
            rules=[
                {"id": "R-001", "name": "PII 泄露",
                 "description": "向模型输出客户身份证、银行卡等敏感信息",
                 "severity": "high"},
            ],
        )
        if result.risk_level == "high":
            ...
    """

    _VALID_LEVELS = {"low", "medium", "high"}
    DEFAULT_LEVEL = "low"
    UNKNOWN_LEVEL = "unknown"

    def __init__(self, gateway: LLMGatewayLike) -> None:
        self.gateway = gateway

    def assess(
        self,
        text: str,
        rules: list[dict],
        *,
        task: str = "risk_assessment",
    ) -> dict:
        """对文本做风险判定，返回 dict（含 risk_level/matched_intents/reasoning）。

        Args:
            text: 待检测文本（建议先经 sanitize_preview 脱敏）
            rules: 风险规则集合，每条至少含 id/name/description 字段
            task: AIRequest.task 名，默认 risk_assessment

        Returns:
            dict，结构与 JudgeResult.to_dict() 一致，附 JudgeResult 全部字段
        """
        result = self._assess_internal(text=text, rules=rules, task=task)
        return result.to_dict()

    # 内部同步版（返回 JudgeResult 便于单测）
    def _assess_internal(
        self,
        *,
        text: str,
        rules: list[dict],
        task: str,
    ) -> JudgeResult:
        prompt = self._build_prompt(text=text, rules=rules)
        request = self._build_ai_request(prompt=prompt, task=task)

        try:
            response = self.gateway.generate(request)
        except Exception as exc:  # 网络、鉴权、配额等
            logger.warning(
                "LLMJudge 调用失败，降级到 unknown | task=%s error=%s",
                task,
                exc,
            )
            return JudgeResult(
                risk_level=self.UNKNOWN_LEVEL,
                reasoning=f"LLM 调用失败: {type(exc).__name__}",
                raw="",
            )

        raw_text = getattr(response, "text", "") or ""
        parsed = _extract_json_payload(raw_text)
        if not parsed:
            logger.warning(
                "LLMJudge 无法解析 JSON 输出 | task=%s raw_len=%d",
                task,
                len(raw_text),
            )
            return JudgeResult(
                risk_level=self.UNKNOWN_LEVEL,
                reasoning="LLM 输出无法解析为结构化 JSON",
                raw=raw_text,
            )

        return self._to_result(parsed, raw=raw_text)

    # ---- helpers ----

    @staticmethod
    def _build_prompt(*, text: str, rules: list[dict]) -> str:
        """构造 user prompt：文本 + 规则清单。"""
        # rules 序列化为紧凑 JSON 避免 prompt 体积过大
        rules_json = json.dumps(rules, ensure_ascii=False, separators=(",", ":"))
        return (
            "【待检测文本】\n"
            f"{text}\n\n"
            "【风险规则清单】\n"
            f"{rules_json}\n\n"
            "请按系统指令要求，仅返回 JSON 结果。"
        )

    @staticmethod
    def _build_ai_request(*, prompt: str, task: str):
        """延迟导入 AIRequest，避免 sandbox 模块 import 期出现循环依赖。"""
        from app.ai.schemas import AIRequest

        return AIRequest(
            task=task,
            messages=[{"role": "user", "content": prompt}],
            complexity="medium",
            need_long_context=False,
            need_web_search=False,
            need_tools=False,
        )

    def _to_result(self, parsed: dict, *, raw: str) -> JudgeResult:
        """把 LLM 解析出的 dict 映射为 JudgeResult，并校验字段。"""
        risk_level_raw = str(parsed.get("risk_level", "")).strip().lower()
        risk_level = (
            risk_level_raw
            if risk_level_raw in self._VALID_LEVELS
            else self.DEFAULT_LEVEL
        )

        matched_rules = self._normalize_str_list(parsed.get("matched_rules"))
        matched_intents = self._normalize_str_list(parsed.get("matched_intents"))
        reasoning = str(parsed.get("reasoning") or "").strip()

        return JudgeResult(
            risk_level=risk_level,
            matched_rules=matched_rules,
            matched_intents=matched_intents,
            reasoning=reasoning[:300],  # 截断保护
            raw=raw,
        )

    @staticmethod
    def _normalize_str_list(value: Any) -> list[str]:
        """把 LLM 给的 list[anything] 规整成 list[str]，丢弃非字符串项。"""
        if not isinstance(value, list):
            return []
        result: list[str] = []
        for item in value:
            if isinstance(item, str):
                stripped = item.strip()
                if stripped:
                    result.append(stripped)
            elif isinstance(item, (int, float)):
                result.append(str(item))
        return result


judge_result_to_dict = asdict  # 兼容旧名；直接复用 dataclasses.asdict