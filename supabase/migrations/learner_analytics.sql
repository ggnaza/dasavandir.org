-- LEARNER ANALYTICS — per-course cohort switch + the stats aggregate
--
-- Apply by hand in the Supabase SQL editor (this repo has no auto-runner).
-- Idempotent; safe to re-run.
--
-- Independent of repair_assignment_max_score.sql — apply in either order. The
-- analytics panel reads progress / lesson_sessions / quiz_responses and never
-- touches assignments.
--
-- Code-first or migration-first are both safe: until this is applied, the RPC 404s,
-- getCourseStats() returns null, and the panel simply does not render (the original
-- cohort-average line stays as a fallback).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Per-course switch for the cohort comparison
--
-- Default true = existing behaviour (the cohort median shows). A course designer
-- can turn it off per course; learners then see only their own figures. Gates the
-- analytics panel, the fallback cohort line, and the module-list cohort marker.

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS show_cohort_comparison boolean NOT NULL DEFAULT true;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. course_learner_stats(course_id) — one row per enrolled learner
--
-- Why an RPC rather than aggregating in app code: lesson_sessions holds 10,168 rows
-- for a single course (TLA 2026). Pulling those per page-load to sum them is
-- untenable, and PostgREST caps a read at 1000 rows by default — a naive fetch
-- silently returns a partial sample and computes a plausible, WRONG median. That is
-- not hypothetical: it produced a 2.6h median during design where the true figure
-- is 9.7h. Aggregating in Postgres returns ~72 rows instead.
--
-- Returns one row per enrolment, so a learner with no activity still appears (zeroes,
-- not absent) and the cohort median is not skewed by silently dropping them.
--
-- Verified by replicating these exact semantics against production data (2026-07-15):
-- 72 rows for TLA 2026; medians lessons 10, quiz 96.1, hours 9.4, pace 3.9/week.

CREATE OR REPLACE FUNCTION course_learner_stats(p_course_id uuid)
RETURNS TABLE (
  user_id        uuid,
  enrolled_at    timestamptz,
  lessons_done   integer,
  seconds_spent  bigint,
  quiz_avg       numeric
)
LANGUAGE sql
STABLE
-- SECURITY INVOKER (the default), deliberately NOT SECURITY DEFINER.
--
-- The only caller is server code holding the service-role key, which already
-- bypasses RLS — so DEFINER buys nothing and costs a great deal: a DEFINER
-- function returning per-learner rows, reachable by `authenticated`, would hand
-- any logged-in user every learner's activity for ANY course id they cared to
-- guess. INVOKER means that even if this is ever granted more widely by mistake,
-- the caller's own RLS still applies.
SET search_path = public
AS $$
  WITH course_lessons AS (
    SELECT id FROM lessons WHERE course_id = p_course_id
  ),
  course_quizzes AS (
    SELECT q.id FROM quizzes q JOIN course_lessons cl ON q.lesson_id = cl.id
  )
  SELECT
    e.user_id,
    e.enrolled_at,
    COALESCE((
      SELECT COUNT(DISTINCT p.lesson_id)
      FROM progress p
      WHERE p.user_id = e.user_id AND p.lesson_id IN (SELECT id FROM course_lessons)
    ), 0)::integer AS lessons_done,
    COALESCE((
      SELECT SUM(s.duration_seconds)
      FROM lesson_sessions s
      WHERE s.user_id = e.user_id AND s.lesson_id IN (SELECT id FROM course_lessons)
    ), 0)::bigint AS seconds_spent,
    (
      SELECT ROUND(AVG(qr.score)::numeric, 1)
      FROM quiz_responses qr
      WHERE qr.user_id = e.user_id AND qr.quiz_id IN (SELECT id FROM course_quizzes)
    ) AS quiz_avg
  FROM enrollments e
  WHERE e.course_id = p_course_id;
$$;

-- Postgres grants EXECUTE on a new function to PUBLIC by default, so the revoke is
-- required — without it this is callable by anon and authenticated regardless of
-- what is granted below. Only server code (service role) may call it.
REVOKE ALL ON FUNCTION course_learner_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION course_learner_stats(uuid) TO service_role;

-- Supporting indexes for the aggregate above (idempotent).
CREATE INDEX IF NOT EXISTS lesson_sessions_user_lesson_idx ON lesson_sessions(user_id, lesson_id);
CREATE INDEX IF NOT EXISTS progress_user_lesson_idx ON progress(user_id, lesson_id);

-- Verify after applying:
--   SELECT count(*) FROM course_learner_stats('<course-uuid>');   -- = enrolled learners
