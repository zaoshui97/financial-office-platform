-- 2026-10-07: 会议邀请码（MeetingSession 表）
-- 撤掉之前在 meetings 表加的字段，统一用 meeting_sessions
ALTER TABLE meetings DROP COLUMN invite_code;
ALTER TABLE meetings DROP COLUMN invite_expires_at;
DROP INDEX idx_meeting_invite_code ON meetings;

ALTER TABLE meeting_sessions
  ADD COLUMN invite_code        VARCHAR(12)  NULL COMMENT '会议邀请码',
  ADD COLUMN invite_expires_at  DATETIME     NULL COMMENT '邀请码过期时间';

CREATE UNIQUE INDEX idx_session_invite_code ON meeting_sessions (invite_code);