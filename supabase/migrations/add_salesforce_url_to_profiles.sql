-- Add Salesforce account URL field to learner profiles
-- Editable by course_managers (for their cohort) and admins/creators

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS salesforce_url text;
