-- Course lifecycle status: active | completed | archived.
-- Set by course staff in the course editor; completed/archived courses sink to
-- the bottom of course lists, archived ones are hidden from the public catalog.
-- Idempotent. Not related to profiles / handle_new_user().
ALTER TABLE courses ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_status_check;
ALTER TABLE courses ADD CONSTRAINT courses_status_check CHECK (status IN ('active', 'completed', 'archived'));
