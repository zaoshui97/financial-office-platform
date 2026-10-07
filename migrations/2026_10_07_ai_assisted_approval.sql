-- 2026-10-07: AI 辅助审批字段
ALTER TABLE approvals
  ADD COLUMN ai_review        LONGTEXT     NULL COMMENT 'AI 辅助审批 4 维度审查报告 JSON',
  ADD COLUMN ai_reviewed_at   VARCHAR(19)  NULL COMMENT 'AI 审查完成时间',
  ADD COLUMN ai_suggestion    VARCHAR(16)  NULL COMMENT 'AI 建议 pass/review/reject';

ALTER TABLE approval_actions
  ADD COLUMN ai_suggestion    VARCHAR(16)  NULL COMMENT '审批时的 AI 建议（审计对比）',
  ADD COLUMN override_reason  TEXT          NULL COMMENT '覆盖 AI 建议的理由';
