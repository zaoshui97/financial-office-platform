"""合规沙箱领域模块。

- kill_switch: 熔断器（单例，env/file/API 三种触发，5s 缓存）
- exceptions: 沙箱异常类（SandboxUnavailable 等）
- rule_engine: 关键词 + 正则的快速风险匹配
- llm_judge: 调用 LLM Gateway 做语义风险判定
- service: check_text 统一入口（规则 → LLM → 合并 → 审计）
"""

from app.sandbox.exceptions import (
    SandboxConfigError,
    SandboxError,
    SandboxLLMError,
    SandboxUnavailable,
)
from app.sandbox.kill_switch import KillSwitch, kill_switch
from app.sandbox.llm_judge import JudgeResult, LLMJudge
from app.sandbox.rule_engine import (
    Rule,
    RuleEngine,
    RuleProvider,
    RuleResult,
    SettingsRuleProvider,
)
from app.sandbox.service import LLM_TRIGGER_LEVELS, VALID_MODES, check_text

__all__ = [
    # kill_switch
    "KillSwitch",
    "kill_switch",
    # exceptions
    "SandboxError",
    "SandboxUnavailable",
    "SandboxConfigError",
    "SandboxLLMError",
    # rule_engine
    "Rule",
    "RuleEngine",
    "RuleProvider",
    "RuleResult",
    "SettingsRuleProvider",
    # llm_judge
    "LLMJudge",
    "JudgeResult",
    # service
    "check_text",
    "VALID_MODES",
    "LLM_TRIGGER_LEVELS",
]
