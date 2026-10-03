"""会议 4 Agent：moderator / noter / decision / dispatcher。

每个 Agent 都遵循统一接口：
  - role: str
  - run(context, blackboard) -> dict

实现要点：
  - BaseAgent.run() 负责构造 Prompt → 调 llm_gateway → 解析 JSON 输出
  - 4 个具体 Agent 通过重写 build_prompt() / parse_output() 来自定义行为
  - 输出统一 JSON 格式，Prompt 末尾强约束 "请以 JSON 格式输出"
  - LLM 解析失败时 fallback 到空 dict，不让黑板写入阻塞会议
"""

from __future__ import annotations

import json
import re
from abc import ABC, abstractmethod
from typing import Any

from app.ai.llm_gateway import llm_gateway
from app.ai.schemas import AITask
from app.core.logging import get_logger
from app.features.agent.blackboard import BlackboardService

logger = get_logger(__name__)

# 强约束：要求 LLM 输出 JSON
JSON_HINT = "\n\n请以严格的 JSON 格式返回结果，不要包含 markdown 代码块标记或额外说明文字。"


class BaseAgent(ABC):
    """会议 Agent 基类：定义统一接口。"""

    role: str = "base"

    # JSON 字段名约定，4 个 Agent 都按这个键返回
    OUTPUT_KEY = "output"

    def run(
        self,
        context: dict[str, Any],
        blackboard: BlackboardService,
    ) -> dict[str, Any]:
        """读取黑板 context + 自身输入 → 调 LLM → 写黑板新状态。

        异常处理：
          - LLM 调用异常：返回 error_info，让会议继续（不阻塞）
          - JSON 解析失败：尝试正则抽取，否则原样返回（调试用）

        返回：要写入黑板的 state dict（含 output + 元数据）。
        """
        try:
            history = self.build_prompt(context)
            raw = llm_gateway.complete(history, contexts=None, task=AITask.AGENT)
            state = self.parse_output(raw)
            state.setdefault("agent_role", self.role)
            state.setdefault("version", 1)
            # 写黑板（乐观锁），拿到新 version
            new_version = blackboard.write(
                session_id=context["session_id"],
                agent_role=self.role,
                state=state,
            )
            state["version"] = new_version
            logger.info(
                "agent 执行成功 | role=%s session=%s version=%s",
                self.role, context.get("session_id"), new_version,
            )
            return state
        except Exception as exc:
            logger.exception("agent 执行失败 | role=%s err=%s", self.role, exc)
            return {
                "agent_role": self.role,
                "error": str(exc),
                "status": "failed",
            }

    @abstractmethod
    def build_prompt(self, context: dict[str, Any]) -> list[dict[str, str]]:
        """构造对话历史：[{"role": "system", ...}, {"role": "user", ...}]"""

    @abstractmethod
    def parse_output(self, raw: str) -> dict[str, Any]:
        """解析 LLM 原始输出为 state dict。"""


# ---------- 抽取 JSON 兼容层 ----------

def _extract_json(raw: str) -> dict[str, Any]:
    """从 LLM 输出里抽 JSON。

    容错策略：
      1. 直接 json.loads（理想情况）
      2. 正则找 ```json ... ``` 代码块
      3. 正则找第一个 { 到最后一个 }
      4. 全部失败 → 返回 {output: raw}
    """
    raw = (raw or "").strip()
    if not raw:
        return {"output": ""}

    # 1) 直接解析
    try:
        result = json.loads(raw)
        return result if isinstance(result, dict) else {"output": result}
    except json.JSONDecodeError:
        pass

    # 2) markdown json 代码块
    code_block = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL)
    if code_block:
        try:
            result = json.loads(code_block.group(1))
            return result if isinstance(result, dict) else {"output": result}
        except json.JSONDecodeError:
            pass

    # 3) 第一个 { 到最后一个 }
    first = raw.find("{")
    last = raw.rfind("}")
    if first != -1 and last != -1 and last > first:
        candidate = raw[first:last + 1]
        try:
            result = json.loads(candidate)
            return result if isinstance(result, dict) else {"output": result}
        except json.JSONDecodeError:
            pass

    # 4) 兜底
    return {"output": raw}


# ---------- 4 个具体 Agent ----------


class ModeratorAgent(BaseAgent):
    """主持人：控场、提问、节奏控制。

    输入：会议主题 + 当前议题 + 黑板最新状态
    输出：下一步指令（继续/深入/总结/暂停）+ 推荐提问
    """

    role = "moderator"

    PROMPT_TEMPLATE = """你是金融行业会议主持人 Agent，负责把控会议节奏。

【会议主题】{topic}
【当前议题】{agenda}
【议题阶段】{phase}

【黑板当前状态】
{blackboard_snapshot}

你的职责：
1. 根据议题阶段判断下一步动作（continue / deep_dive / summarize / pause）
2. 给主持人推荐 1-2 个引导性问题，推动讨论深入
3. 如有风险/分歧，给出节奏控制建议

请输出 JSON：
{{
  "action": "continue | deep_dive | summarize | pause",
  "questions": ["问题1", "问题2"],
  "pacing_notes": "节奏控制建议（≤80字）",
  "summary_so_far": "当前会议纪要要点（≤120字）"
}}"""

    def build_prompt(self, context: dict[str, Any]) -> list[dict[str, str]]:
        topic = context.get("topic", "未指定")
        agenda = context.get("agenda", "未指定议题")
        phase = context.get("phase", "open")
        snapshot = json.dumps(
            context.get("blackboard_snapshot", {}),
            ensure_ascii=False,
            indent=2,
        )
        user = self.PROMPT_TEMPLATE.format(
            topic=topic, agenda=agenda, phase=phase, blackboard_snapshot=snapshot,
        ) + JSON_HINT
        return [
            {"role": "system", "content": "你是专业会议主持人，输出严格 JSON。"},
            {"role": "user", "content": user},
        ]

    def parse_output(self, raw: str) -> dict[str, Any]:
        return _extract_json(raw)


class NoterAgent(BaseAgent):
    """记录员：转写、摘要、决议记录。

    输入：最近一段转录文本
    输出：抽取的关键信息 + 决议记录
    """

    role = "noter"

    PROMPT_TEMPLATE = """你是金融行业会议记录员 Agent，负责从转录文本中抽取关键信息。

【最近转录】
{transcript}

【黑板当前状态】
{blackboard_snapshot}

你的职责：
1. 抽取关键信息（数字、指标、决策点）
2. 记录本轮决议（如有）
3. 标记待澄清 / 待补充的问题

请输出 JSON：
{{
  "key_points": ["要点1", "要点2", ...],
  "decisions": ["决议1", ...],
  "open_questions": ["待澄清1", ...],
  "entities": {{"公司名": ["A 公司", "B 银行"], "数字": ["3.5%", "100 亿"]}}
}}"""

    def build_prompt(self, context: dict[str, Any]) -> list[dict[str, str]]:
        transcript = context.get("transcript", "")
        snapshot = json.dumps(
            context.get("blackboard_snapshot", {}),
            ensure_ascii=False,
            indent=2,
        )
        user = self.PROMPT_TEMPLATE.format(
            transcript=transcript[:4000],  # 限长，避免超 token
            blackboard_snapshot=snapshot,
        ) + JSON_HINT
        return [
            {"role": "system", "content": "你是专业会议记录员，输出严格 JSON。"},
            {"role": "user", "content": user},
        ]

    def parse_output(self, raw: str) -> dict[str, Any]:
        return _extract_json(raw)


class DecisionAgent(BaseAgent):
    """决策追踪：识别决策项、风险项、共识度。

    输入：全部 Agent 的最新输出（汇总）
    输出：决策项 + 风险项 + 共识度评估
    """

    role = "decision"

    PROMPT_TEMPLATE = """你是金融行业会议决策追踪 Agent，负责识别决策和风险。

【议题】{agenda}
【会议阶段】{phase}

【全部 Agent 最新输出】
{all_outputs}

你的职责：
1. 识别明确的决策项（含决策人 / 待执行内容 / 截止时间）
2. 识别风险项（含风险类型 / 等级 / 缓解建议）
3. 评估当前议题的共识度（0-1）
4. 标记未达成共识的分歧点

请输出 JSON：
{{
  "decisions": [
    {{"item": "...", "owner": "...", "deadline": "...", "confidence": 0.0-1.0}}
  ],
  "risks": [
    {{"type": "合规|市场|信用|操作|流动性", "level": "low|medium|high", "mitigation": "..."}}
  ],
  "consensus_score": 0.0,
  "disagreements": ["分歧点1", ...]
}}"""

    def build_prompt(self, context: dict[str, Any]) -> list[dict[str, str]]:
        agenda = context.get("agenda", "未指定议题")
        phase = context.get("phase", "open")
        snapshot = context.get("blackboard_snapshot", {})
        all_outputs = json.dumps(snapshot, ensure_ascii=False, indent=2)
        user = self.PROMPT_TEMPLATE.format(
            agenda=agenda, phase=phase, all_outputs=all_outputs,
        ) + JSON_HINT
        return [
            {"role": "system", "content": "你是决策分析专家，输出严格 JSON。"},
            {"role": "user", "content": user},
        ]

    def parse_output(self, raw: str) -> dict[str, Any]:
        return _extract_json(raw)


class DispatcherAgent(BaseAgent):
    """派单：把决策项拆解为可执行工单。

    输入：决策 Agent 输出的决议列表
    输出：待办工单列表（含分配人 / 截止时间 / 优先级）
    """

    role = "dispatcher"

    PROMPT_TEMPLATE = """你是金融行业会议派单 Agent，负责把决策项拆解为可执行工单。

【会议主题】{topic}
【决策项】
{decisions}

【风险项】
{risks}

你的职责：
1. 每个决策项拆解为 1-N 个工单
2. 给每个工单分配 owner（角色，如风控/合规/业务/IT）
3. 估算工时和截止时间
4. 评估优先级

请输出 JSON：
{{
  "tickets": [
    {{
      "title": "工单标题",
      "description": "详细描述",
      "owner": "角色",
      "priority": "P0|P1|P2|P3",
      "estimate_hours": 0,
      "deadline": "YYYY-MM-DD",
      "source_decision": "对应决策项"
    }}
  ],
  "total_workload_hours": 0
}}"""

    def build_prompt(self, context: dict[str, Any]) -> list[dict[str, str]]:
        topic = context.get("topic", "未指定")
        snapshot = context.get("blackboard_snapshot", {})
        decision_state = snapshot.get("decision", {})
        decisions = json.dumps(
            decision_state.get("decisions", []),
            ensure_ascii=False, indent=2,
        )
        risks = json.dumps(
            decision_state.get("risks", []),
            ensure_ascii=False, indent=2,
        )
        user = self.PROMPT_TEMPLATE.format(
            topic=topic, decisions=decisions or "（暂无决策）", risks=risks or "（暂无风险）",
        ) + JSON_HINT
        return [
            {"role": "system", "content": "你是任务派单专家，输出严格 JSON。"},
            {"role": "user", "content": user},
        ]

    def parse_output(self, raw: str) -> dict[str, Any]:
        return _extract_json(raw)


# ---------- Agent 工厂 ----------

AGENT_REGISTRY: dict[str, type[BaseAgent]] = {
    "moderator": ModeratorAgent,
    "noter": NoterAgent,
    "decision": DecisionAgent,
    "dispatcher": DispatcherAgent,
}


def get_agent(role: str) -> BaseAgent:
    """按角色名获取 Agent 实例，未知角色抛错。"""
    cls = AGENT_REGISTRY.get(role)
    if cls is None:
        raise ValueError(
            f"未知 Agent 角色: {role} | 已知: {list(AGENT_REGISTRY.keys())}"
        )
    return cls()