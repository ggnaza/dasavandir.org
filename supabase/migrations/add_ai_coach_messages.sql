-- Store individual AI Coach messages per session for conversation history
CREATE TABLE IF NOT EXISTS ai_coach_messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid        NOT NULL REFERENCES ai_coach_sessions(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id   uuid        NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  role        text        NOT NULL CHECK (role IN ('user', 'assistant')),
  content     text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_coach_messages_session
  ON ai_coach_messages (session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_coach_messages_user_course
  ON ai_coach_messages (user_id, course_id, created_at DESC);

ALTER TABLE ai_coach_messages ENABLE ROW LEVEL SECURITY;

-- Learners can read their own messages
CREATE POLICY "Users read own coach messages" ON ai_coach_messages
  FOR SELECT USING (auth.uid() = user_id);

-- Service role writes (API routes use admin client)
CREATE POLICY "Service role manages coach messages" ON ai_coach_messages
  FOR ALL TO service_role USING (true) WITH CHECK (true);
