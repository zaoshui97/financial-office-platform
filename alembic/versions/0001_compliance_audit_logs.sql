-- 合规沙箱审计日志表
-- 设计：仅存 prompt/answer 的 SHA-256 摘要 + 长度 + 脱敏前 500 字预览，原文永不落库。

CREATE TABLE IF NOT EXISTS compliance_audit_logs (
    id              BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id         BIGINT       NOT NULL COMMENT '调用用户ID',
    conversation_id BIGINT       NULL     COMMENT '关联的聊天会话ID',
    request_id      VARCHAR(64)  NOT NULL COMMENT 'AI 请求追踪ID',
    mode            VARCHAR(32)  NOT NULL COMMENT '回答模式: compliance_sandbox',
    provider        VARCHAR(64)  NOT NULL COMMENT '实际调用的 Provider',
    model           VARCHAR(128) NOT NULL COMMENT '实际调用的模型',
    prompt_hash     VARCHAR(64)  NOT NULL COMMENT '原始 prompt 的 SHA-256',
    prompt_length   BIGINT       NOT NULL COMMENT '原始 prompt 字符数',
    prompt_preview  TEXT         NOT NULL COMMENT '脱敏后的前 500 字预览',
    answer_hash     VARCHAR(64)  NULL     COMMENT '回答的 SHA-256',
    answer_length   BIGINT       NULL     COMMENT '回答字符数',
    answer_preview  TEXT         NULL     COMMENT '回答脱敏后的前 500 字预览',
    pii_detected    JSON         NULL     COMMENT '命中的 PII 规则及次数',
    risk_hits       JSON         NULL     COMMENT '命中的风险词列表',
    blocked         TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '是否被拦截',
    block_reason    VARCHAR(128) NULL     COMMENT '拦截原因',
    latency_ms      FLOAT        NULL     COMMENT '调用耗时毫秒',
    completed_at    DATETIME     NULL     COMMENT '调用结束时间',
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_compliance_audit_user_created (user_id, created_at),
    INDEX idx_compliance_audit_request (request_id),
    INDEX idx_compliance_audit_blocked (blocked)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='合规沙箱调用审计日志';