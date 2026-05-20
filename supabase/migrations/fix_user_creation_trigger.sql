-- ============================================================
-- CRITICAL FIX: "Database error saving new user"
-- Run this in Supabase → SQL Editor (idempotent — safe to re-run)
--
-- This fix solves BOTH:
--   • Email/password signup → "Database error saving new user"
--   • Google SSO → "no_code" error on the login page
-- Both have the same root cause: the handle_new_user() trigger
-- throws an exception, which rolls back the auth.users insert and
-- causes Supabase to redirect the OAuth flow with an error instead
-- of a code.
-- ============================================================

-- 1. Ensure profiles columns exist (any may be missing on older DBs)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'learner';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Make email + full_name nullable (trigger may insert with NULLs)
ALTER TABLE profiles ALTER COLUMN email DROP NOT NULL;
ALTER TABLE profiles ALTER COLUMN full_name DROP NOT NULL;

-- Ensure proper defaults
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'learner';
ALTER TABLE profiles ALTER COLUMN status SET DEFAULT 'active';

-- 2. Refresh role + status check constraints to include all valid values
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'course_creator', 'course_manager', 'learner'));

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_status_check
  CHECK (status IN ('pending', 'active'));

-- 3. Bulletproof trigger — wrapped in EXCEPTION so it can NEVER block user creation.
--    Role is never taken from raw_user_meta_data (security: prevents privilege escalation).
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_existing_role text;
BEGIN
  -- Inherit role from any pre-existing profile with the same email
  -- (handles case where Google OAuth creates a new auth user for an email
  --  that was previously created via password signup)
  BEGIN
    SELECT role INTO v_existing_role
    FROM profiles
    WHERE email = NEW.email
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_existing_role := NULL;
  END;

  INSERT INTO profiles (id, full_name, email, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.email,
    COALESCE(v_existing_role, 'learner'),
    'active'
  )
  ON CONFLICT (id) DO UPDATE
    SET email     = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Any unexpected failure becomes a warning, NOT a user-blocking error.
  -- The profile can be backfilled later (see step 5 below).
  RAISE WARNING '[handle_new_user] profile insert failed for user % (%): %',
    NEW.id, NEW.email, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Reinstall trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- 5. Backfill profiles for any auth users that are missing one
INSERT INTO profiles (id, full_name, email, role, status)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  u.email,
  'learner',
  'active'
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 6. Backfill email on any profiles that have it null
UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;
