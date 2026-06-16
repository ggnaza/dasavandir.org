-- Course-creator configurable AI coach instructions.
-- The feature code (admin config page + /api/admin/courses/[id]/ai-coach-settings
-- + the learner chat route) reads/writes courses.ai_coach_instructions, but the
-- column was shipped without a migration. This adds it idempotently.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS ai_coach_instructions text;
