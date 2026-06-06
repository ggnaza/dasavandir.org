-- Add ai_coach_enabled flag to courses (default ON for all existing courses)
ALTER TABLE courses ADD COLUMN IF NOT EXISTS ai_coach_enabled boolean NOT NULL DEFAULT true;
