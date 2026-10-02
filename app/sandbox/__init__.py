"""合规沙箱领域模块：风险判定、对 LLM 返回的语义解析与规则匹配。

边界：
- 不直接处理 HTTP（由 app.features.compliance.* 接入）
- 不写审计日志（由 service.execute_sandbox_chat 统一落库）
- 只做"调用 LLM Gateway → 抽 JSON → 映射到内部决策"
"""

from app.sandbox.llm_judge import LLMJudge, JudgeResult

__all__ = ["LLMJudge", "JudgeResult"]