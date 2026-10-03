-- 手工补建 2 张缺失表（替代 migration 9ca81cc70198 中的建表）
-- 原因：上一轮 migration 因 VARCHAR(65535) 失败，4 张表里有 2 张未建

CREATE TABLE IF NOT EXISTS agent_executions (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    session_id BIGINT NOT NULL COMMENT '关联的会议会话 ID',
    agent_role VARCHAR(32) NOT NULL COMMENT 'moderator / noter / decision / dispatcher',
    `trigger` VARCHAR(32) NOT NULL COMMENT 'speech_chunk / state_update',
    input_snapshot JSON NOT NULL COMMENT '触发时的输入快照',
    output TEXT NOT NULL COMMENT 'Agent 输出内容（纯文本，最大 64KB）',
    status VARCHAR(16) NOT NULL DEFAULT 'thinking' COMMENT 'thinking / done / failed',
    finished_at DATETIME NULL COMMENT '执行结束时间',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    KEY idx_execution_session_role (session_id, agent_role),
    KEY idx_execution_status (status),
    KEY ix_agent_executions_session_id (session_id),
    CONSTRAINT fk_execution_session FOREIGN KEY (session_id) REFERENCES meeting_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS meeting_blackboard (
    id INT NOT NULL AUTO_INCREMENT,
    session_id BIGINT NOT NULL COMMENT '关联的会议会话 ID',
    agent_role VARCHAR(32) NOT NULL,
    state_json JSON NOT NULL,
    version BIGINT NOT NULL DEFAULT 0 COMMENT '乐观锁版本号',
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY idx_blackboard_session_role (session_id, agent_role),
    KEY ix_meeting_blackboard_session_id (session_id),
    CONSTRAINT fk_blackboard_session FOREIGN KEY (session_id) REFERENCES meeting_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
