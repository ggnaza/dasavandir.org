-- REPAIR: assignments.max_score — the column the app already reads everywhere
--
-- Apply by hand in the Supabase SQL editor (this repo has no auto-runner).
-- Idempotent; safe to re-run.
--
-- WHY THIS EXISTS
-- add_assignment_max_score.sql adds this column, but it was never applied, so the
-- column is still absent in production. Every query selecting it fails with 42703,
-- the caller discards the error, `?? []` turns the null into an empty list, and the
-- surface renders confidently with nothing. Verified broken against production:
--
--   FAIL 400 | analytics/page.tsx:68             column assignments.max_score does not exist
--   FAIL 400 | learners/[userId]/page.tsx:53     column assignments.max_score does not exist
--   FAIL 400 | api/chat/route.ts:131 (AI coach)  column assignments.max_score does not exist
--   OK   200 | (control) same query without max_score → 9 rows
--
-- Consequences today: the admin course analytics shows no assignment data at all and
-- its "overall score" silently degrades to quiz-only; the per-learner gradebook shows
-- no assignment scores; and the AI coach receives no assignment or score context when
-- advising learners. TLA 2026 alone has 347 submissions that none of these can read.
--
-- ADDING THE COLUMN IS NOT SUFFICIENT
-- max_score would be NULL on every row, and the percentage maths in
-- analytics/page.tsx:139 filters on maxScore being truthy — so assignment averages
-- would stay blank and the page would look just as broken. The rubric already carries
-- the real total, so derive it rather than guess.

ALTER TABLE assignments ADD COLUMN IF NOT EXISTS max_score integer;

-- Backfill from the rubric's own max_points. Only fills NULLs, so a hand-set
-- max_score is never clobbered and re-running is a no-op.
--
-- Two defensive details, both deliberate:
--  * jsonb_array_elements() is fed a CASE, not the raw column. A set-returning
--    function in a LATERAL is not guaranteed to run after the WHERE, so filtering
--    on jsonb_typeof there would still let a non-array rubric raise.
--  * max_points is summed through a digit check rather than a bare ::int cast, so
--    one malformed rubric entry cannot abort the whole migration.
--
-- Dry-run over all 11 assignments in production (2026-07-15): 11 would be set,
-- 0 left NULL, resulting maxima {9: x8, 10: x2, 16: x1}; 0 entries would have
-- choked a bare cast; 0 non-array rubrics. The guards are insurance for future rows.
UPDATE assignments a
SET max_score = r.total
FROM (
  SELECT
    x.id,
    SUM(
      CASE WHEN (elem ->> 'max_points') ~ '^[0-9]+$'
           THEN (elem ->> 'max_points')::int
           ELSE 0 END
    ) AS total
  FROM assignments x
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(x.rubric) = 'array' THEN x.rubric ELSE '[]'::jsonb END
  ) AS elem
  GROUP BY x.id
) r
WHERE a.id = r.id
  AND a.max_score IS NULL
  AND r.total > 0;

-- Verify after applying — every assignment should report a max_score:
--   SELECT id, title, max_score FROM assignments ORDER BY max_score NULLS FIRST;
