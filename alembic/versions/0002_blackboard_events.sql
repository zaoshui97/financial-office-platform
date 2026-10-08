-- 4 Agent 共享黑板：会话 + 事件
-- 设计：MySQL JSON 字段上限约 64KB（service 层会校验 payload 序列化字节数）。

CREATE TABLE IF NOT EXISTS blackboard_sessions (
    id          BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    owner_id    BIGINT       NOT NULL COMMENT 'session 所有者',
    session_id  VARCHAR(64)  NOT NULL COMMENT '对外暴露的 UUID',
    title       VARCHAR(200) NOT NULL COMMENT 'session 标题',
    status      VARCHAR(16)  NOT NULL DEFAULT 'open' COMMENT 'open / closed',
    closed_at   VARCHAR(32)  NULL     COMMENT '关闭时间（ISO8601 字符串）',
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_blackboard_session_id (session_id),
    INDEX idx_blackboard_session_owner (owner_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='多 Agent 协作 session';

CREATE TABLE IF NOT EXISTS blackboard_events (
    id              BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    owner_id        BIGINT       NOT NULL COMMENT '事件归属 user_id',
    session_id      VARCHAR(64)  NOT NULL COMMENT '关联 session_id',
    agent_role      VARCHAR(32)  NOT NULL COMMENT 'researcher/planner/executor/reviewer',
    event_type      VARCHAR(64)  NOT NULL COMMENT 'agent 自定义事件类型',
    payload         JSON         NOT NULL COMMENT '事件负载（≤64KB）',
    parent_event_id BIGINT       NULL     COMMENT '父事件 ID（可选）',
    created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                  ON UPDATE CURRENT_TIMESTAMP(3),
    INDEX idx_blackboard_session_created (session_id, created_at),
    INDEX idx_blackboard_role_type (agent_role, event_type),
    INDEX idx_blackboard_owner_session (owner_id, session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='多 Agent 共享黑板事件';