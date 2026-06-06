-- Add course_type to courses: program | internal
ALTER TABLE courses ADD COLUMN IF NOT EXISTS course_type text NOT NULL DEFAULT 'program'
  CHECK (course_type IN ('program', 'internal'));
