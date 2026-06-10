-- RLS policies for authenticated writes from browser clients.
--
-- Context: enable_rls_all_tables.sql enabled RLS on all tables with no policies,
-- which correctly blocks unauthenticated (anon key without JWT) direct REST access.
-- BUT it also blocked authenticated course creators who use the browser Supabase
-- client to write to courses / lessons / quizzes / question_bank from the admin UI.
--
-- These policies restore legitimate write access for course staff (admin, course_creator,
-- course_manager) while keeping all unauthenticated access blocked.
--
-- Security model:
--   Service role (createAdminClient) — bypasses RLS entirely, used by all API routes.
--   Authenticated role (browser createClient) — needs explicit policies below.
--   Anon role (no JWT) — default deny (no policies for anon = blocked). ✓
--
-- Run this in Supabase → SQL Editor.

-- ── Helper: check if the current authenticated user is course staff ──────────
-- Reusable in all policies below.

-- ── courses ──────────────────────────────────────────────────────────────────
-- Admins can do anything; course_creators can update/delete courses they own
-- (either created_by = them OR they have a course_creator_access row).

DROP POLICY IF EXISTS "course_staff_can_update_courses" ON courses;
CREATE POLICY "course_staff_can_update_courses"
  ON courses FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM course_creator_access
      WHERE creator_id = auth.uid() AND course_id = courses.id
    )
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM course_creator_access
      WHERE creator_id = auth.uid() AND course_id = courses.id
    )
  );

DROP POLICY IF EXISTS "course_staff_can_delete_courses" ON courses;
CREATE POLICY "course_staff_can_delete_courses"
  ON courses FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM course_creator_access
      WHERE creator_id = auth.uid() AND course_id = courses.id
    )
  );

-- ── lessons ───────────────────────────────────────────────────────────────────
-- Admins and course creators can insert, update, and delete lessons in courses
-- they have access to.

DROP POLICY IF EXISTS "course_staff_can_insert_lessons" ON lessons;
CREATE POLICY "course_staff_can_insert_lessons"
  ON lessons FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR EXISTS (
      SELECT 1 FROM courses
      WHERE id = lessons.course_id
        AND (
          created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM course_creator_access
            WHERE creator_id = auth.uid() AND course_id = courses.id
          )
        )
    )
  );

DROP POLICY IF EXISTS "course_staff_can_update_lessons" ON lessons;
CREATE POLICY "course_staff_can_update_lessons"
  ON lessons FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR EXISTS (
      SELECT 1 FROM courses
      WHERE id = lessons.course_id
        AND (
          created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM course_creator_access
            WHERE creator_id = auth.uid() AND course_id = courses.id
          )
        )
    )
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR EXISTS (
      SELECT 1 FROM courses
      WHERE id = lessons.course_id
        AND (
          created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM course_creator_access
            WHERE creator_id = auth.uid() AND course_id = courses.id
          )
        )
    )
  );

DROP POLICY IF EXISTS "course_staff_can_delete_lessons" ON lessons;
CREATE POLICY "course_staff_can_delete_lessons"
  ON lessons FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR EXISTS (
      SELECT 1 FROM courses
      WHERE id = lessons.course_id
        AND (
          created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM course_creator_access
            WHERE creator_id = auth.uid() AND course_id = courses.id
          )
        )
    )
  );

-- ── quizzes ───────────────────────────────────────────────────────────────────
-- Course staff can insert, update, and delete quizzes for their lessons.

DROP POLICY IF EXISTS "course_staff_can_insert_quizzes" ON quizzes;
CREATE POLICY "course_staff_can_insert_quizzes"
  ON quizzes FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR EXISTS (
      SELECT 1 FROM lessons
      JOIN courses ON courses.id = lessons.course_id
      WHERE lessons.id = quizzes.lesson_id
        AND (
          courses.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM course_creator_access
            WHERE creator_id = auth.uid() AND course_id = courses.id
          )
        )
    )
  );

DROP POLICY IF EXISTS "course_staff_can_update_quizzes" ON quizzes;
CREATE POLICY "course_staff_can_update_quizzes"
  ON quizzes FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR EXISTS (
      SELECT 1 FROM lessons
      JOIN courses ON courses.id = lessons.course_id
      WHERE lessons.id = quizzes.lesson_id
        AND (
          courses.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM course_creator_access
            WHERE creator_id = auth.uid() AND course_id = courses.id
          )
        )
    )
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR EXISTS (
      SELECT 1 FROM lessons
      JOIN courses ON courses.id = lessons.course_id
      WHERE lessons.id = quizzes.lesson_id
        AND (
          courses.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM course_creator_access
            WHERE creator_id = auth.uid() AND course_id = courses.id
          )
        )
    )
  );

DROP POLICY IF EXISTS "course_staff_can_delete_quizzes" ON quizzes;
CREATE POLICY "course_staff_can_delete_quizzes"
  ON quizzes FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR EXISTS (
      SELECT 1 FROM lessons
      JOIN courses ON courses.id = lessons.course_id
      WHERE lessons.id = quizzes.lesson_id
        AND (
          courses.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM course_creator_access
            WHERE creator_id = auth.uid() AND course_id = courses.id
          )
        )
    )
  );

-- ── question_bank ─────────────────────────────────────────────────────────────
-- Course staff can insert and delete from their own question bank.
-- question_bank rows reference course_id directly.

DROP POLICY IF EXISTS "course_staff_can_insert_question_bank" ON question_bank;
CREATE POLICY "course_staff_can_insert_question_bank"
  ON question_bank FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR EXISTS (
      SELECT 1 FROM courses
      WHERE id = question_bank.course_id
        AND (
          created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM course_creator_access
            WHERE creator_id = auth.uid() AND course_id = courses.id
          )
        )
    )
  );

DROP POLICY IF EXISTS "course_staff_can_delete_question_bank" ON question_bank;
CREATE POLICY "course_staff_can_delete_question_bank"
  ON question_bank FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR EXISTS (
      SELECT 1 FROM courses
      WHERE id = question_bank.course_id
        AND (
          created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM course_creator_access
            WHERE creator_id = auth.uid() AND course_id = courses.id
          )
        )
    )
  );

-- Note: SELECT policies are NOT needed for these tables because all admin
-- page reads go through createAdminClient() (service role) in server components,
-- which bypasses RLS entirely.
