-- ============================================================
-- FEATURES V2 MIGRATION
-- Run this once in Supabase → SQL Editor
-- ============================================================

-- ─── FEATURE 1: Lesson deadlines ───────────────────────────
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS deadline_days integer;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS deadline_date date;

-- ─── FEATURE 3: AI tutor memory ────────────────────────────
CREATE TABLE IF NOT EXISTS ai_coach_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  summary text NOT NULL DEFAULT '',
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, course_id)
);

ALTER TABLE ai_coach_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own ai memory" ON ai_coach_memory
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Service role manages ai memory" ON ai_coach_memory
  FOR ALL USING (true)
  WITH CHECK (true);

-- ─── FEATURE 5: Pre-submission AI feedback toggle ──────────
ALTER TABLE courses ADD COLUMN IF NOT EXISTS pre_submission_ai boolean DEFAULT false;

-- ─── FEATURE 6: Question bank ──────────────────────────────
CREATE TABLE IF NOT EXISTS question_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  question text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]',
  correct integer NOT NULL DEFAULT 0,
  topic text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE question_bank ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and creators manage question bank" ON question_bank
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'course_creator'))
  );

CREATE POLICY "Learners can view question bank" ON question_bank
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM enrollments WHERE user_id = auth.uid() AND course_id = question_bank.course_id)
  );

ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS use_bank boolean DEFAULT false;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS bank_count integer DEFAULT 5;

-- ─── FEATURE 8: Certificate tracking ───────────────────────
CREATE TABLE IF NOT EXISTS certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  certificate_number text UNIQUE NOT NULL,
  issued_at timestamptz DEFAULT now(),
  UNIQUE(user_id, course_id)
);

ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own certificates" ON certificates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins view all certificates" ON certificates
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Allow insert via service role (no RLS for insert with service key)
CREATE POLICY "Allow insert certificates" ON certificates
  FOR INSERT WITH CHECK (true);

-- ─── FEATURE 2: Ensure course_manager role exists ──────────
-- (already added by course_manager_access.sql migration, this is a safety re-run)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_role_check'
    AND table_name = 'profiles'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
      CHECK (role IN ('admin', 'course_creator', 'course_manager', 'learner'));
  END IF;
END $$;

-- Allow course creators to assign moderators to their courses
CREATE POLICY IF NOT EXISTS "Creators manage their course moderators" ON course_manager_access
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM course_creator_access
      WHERE creator_id = auth.uid() AND course_id = course_manager_access.course_id
    )
  );
