-- Add access_type to courses: public | private | paid
ALTER TABLE courses ADD COLUMN IF NOT EXISTS access_type text NOT NULL DEFAULT 'private'
  CHECK (access_type IN ('public', 'private', 'paid'));

-- Backfill from is_paid
UPDATE courses SET access_type = 'paid' WHERE is_paid = true;
