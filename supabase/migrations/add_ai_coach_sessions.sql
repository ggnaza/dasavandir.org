-- AI Coach session tracking
-- Stores aggregate session metadata WITHOUT chat content — privacy-safe
-- One row per session (session = gap of ≤30 min between messages)

CREATE TABLE IF NOT EXISTS ai_coach_sessions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id      uuid        NOT NULL REFERENCES courses(id)  ON DELETE CASCADE,
  lesson_id      uuid        REFERENCES lessons(id)  ON DELETE SET NULL,
  started_at     timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  message_count  integer     NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_ai_coach_sessions_user_course
  ON ai_coach_sessions (user_id, course_id);

CREATE INDEX IF NOT EXISTS idx_ai_coach_sessions_course
  ON ai_coach_sessions (course_id);

-- RLS: disable (service-role-only writes from API routes)
ALTER TABLE ai_coach_sessions DISABLE ROW LEVEL SECURITY;
