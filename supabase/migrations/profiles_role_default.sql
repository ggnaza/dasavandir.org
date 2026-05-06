-- Add a default value to profiles.role so the auth trigger doesn't fail
-- when creating users without an explicit role
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'learner';
