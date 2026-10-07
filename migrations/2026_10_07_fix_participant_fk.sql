-- 改 meeting_participants.meeting_id 的 FK：meetings.id -> meeting_sessions.id
ALTER TABLE meeting_participants DROP FOREIGN KEY meeting_participants_ibfk_1;
ALTER TABLE meeting_participants
  ADD CONSTRAINT meeting_participants_meeting_fk
  FOREIGN KEY (meeting_id) REFERENCES meeting_sessions(id) ON DELETE CASCADE;