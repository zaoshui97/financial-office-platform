"""智能审批模块模型。

两张表：
  - approvals       审批主表（请假/报销/用印/通用）
  - approval_actions 审批操作流水（通过/驳回/催办/评论）

设计：
  - 3 类审批 + 1 兜底 = 4 种 type
  - status 流转：draft → pending → approved/rejected → closed
  - 提交时由 service 层调沙箱检测（如果接入 sandbox/service）
  - 每个操作落 approval_actions 流水，便于审计
"""

from __future__ import annotations

from enum import StrEnum

from sqlalchemy import (
    BigInteger,
    ForeignKey,
    Index,
    String,
    Text,
)
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, TimestampMixin


# ---------- 枚举 ----------


class ApprovalType(StrEnum):
    """审批类型。"""

    LEAVE = "leave"           # 请假
    REIMBURSE = "reimburse"   # 报销
    SEAL = "seal"             # 用印
    GENERAL = "general"       # 通用


class ApprovalStatus(StrEnum):
    """审批状态。"""

    DRAFT = "draft"           # 草稿（来自工单/会议）
    PENDING = "pending"       # 待审
    APPROVED = "approved"     # 已通过
    REJECTED = "rejected"     # 已驳回
    CLOSED = "closed"         # 已关闭（撤回/作废）


class ApprovalActionType(StrEnum):
    """审批操作类型（流水）。"""

    SUBMIT = "submit"         # 提交
    APPROVE = "approve"       # 通过
    REJECT = "reject"         # 驳回
    URGE = "urge"             # 催办
    COMMENT = "comment"       # 评论
    CLOSE = "close"           # 关闭


# ---------- 表 ----------


class Approval(TimestampMixin, Base):
    """审批主表。"""

    __tablename__ = "approvals"
    __table_args__ = (
        Index("idx_approval_user", "user_id"),
        Index("idx_approval_status", "status"),
        Index("idx_approval_type", "type"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="申请人 user_id",
    )
    type: Mapped[str] = mapped_column(
        String(20), nullable=False,
        comment="leave / reimburse / seal / general",
    )
    title: Mapped[str | None] = mapped_column(
        String(200), nullable=True,
        comment="审批标题（可选，自动从 content 第一行提取）",
    )
    content: Mapped[str] = mapped_column(
        Text, nullable=False,
        comment="审批正文（≤64KB）",
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False,
        default=ApprovalStatus.PENDING.value,
        comment="draft/pending/approved/rejected/closed",
    )
    sandbox_check: Mapped[str | None] = mapped_column(
        Text, nullable=True,
        comment="沙箱检测结果 JSON（提交时由 service 落）",
    )
    sandbox_passed: Mapped[bool | None] = mapped_column(
        nullable=True,
        comment="沙箱是否通过（True/False/None=未检测）",
    )
    ai_review: Mapped[str | None] = mapped_column(
        Text().with_variant(LONGTEXT, "mysql"),
        nullable=True,
        comment="AI 辅助审批 4 维度审查报告 JSON（见 ai_reviewer.py）",
    )
    ai_reviewed_at: Mapped[str | None] = mapped_column(
        String(19), nullable=True,
        comment="AI 审查完成时间 ISO8601",
    )
    ai_suggestion: Mapped[str | None] = mapped_column(
        String(16), nullable=True,
        comment="AI 建议：pass/review/reject",
    )
    approved_by: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="最终审批人 user_id",
    )
    closed_at: Mapped[str | None] = mapped_column(
        String(19), nullable=True,
        comment="关闭时间（ISO8601）",
    )


class ApprovalAction(TimestampMixin, Base):
    """审批操作流水：所有动作（提交/通过/驳回/催办/评论）都落一条。"""

    __tablename__ = "approval_actions"
    __table_args__ = (
        Index("idx_action_approval", "approval_id"),
        Index("idx_action_operator", "operator_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    approval_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("approvals.id", ondelete="CASCADE"),
        nullable=False,
        comment="关联审批 ID",
    )
    operator_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="操作人 user_id",
    )
    action: Mapped[str] = mapped_column(
        String(16), nullable=False,
        comment="submit/approve/reject/urge/comment/close",
    )
    comment: Mapped[str | None] = mapped_column(
        Text, nullable=True,
        comment="意见/备注",
    )
    ai_suggestion: Mapped[str | None] = mapped_column(
        String(16), nullable=True,
        comment="审批时的 AI 建议：pass/review/reject（用于审计对比）",
    )
    override_reason: Mapped[str | None] = mapped_column(
        Text, nullable=True,
        comment="覆盖 AI 建议时填写的理由（合规审计需要）",
    )
