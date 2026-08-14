-- Course-level learner suspension.
--
-- Adds a reversible status to `enrollments` so a learner can be suspended from a
-- course WITHOUT deleting their enrollment row. A hard delete loses `enrolled_at`
-- (the anchor for deadline_days due dates) and removes the learner from every
-- roster/analytics view; suspension keeps the row and all history, and is a
-- single reversible flag.
--
-- Idempotent: safe to run more than once.

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz;

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS suspended_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS suspend_reason text;

-- Constrain the allowed values. Drop-then-add so re-running stays clean.
ALTER TABLE enrollments DROP CONSTRAINT IF EXISTS enrollments_status_check;
ALTER TABLE enrollments
  ADD CONSTRAINT enrollments_status_check CHECK (status IN ('active', 'suspended'));

-- Roster/stats queries filter by (course_id, status).
CREATE INDEX IF NOT EXISTS enrollments_course_status_idx
  ON enrollments (course_id, status);
