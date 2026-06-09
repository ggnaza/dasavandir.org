-- Private reflection journal entries per learner per course
CREATE TABLE IF NOT EXISTS reflections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reflections_user_course ON reflections(user_id, course_id);

ALTER TABLE reflections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own reflections" ON reflections;
CREATE POLICY "Users can manage their own reflections" ON reflections
  FOR ALL USING (auth.uid() = user_id);
