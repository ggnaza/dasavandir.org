-- Per-submission reviewer override. When set, this person is the assigned
-- reviewer for the submission, overriding the default (the moderator of the
-- learner's group). Set via the "Reassign" button on the submissions table.
-- Nullable; null means "use the group moderator". Idempotent.
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS reviewer_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
