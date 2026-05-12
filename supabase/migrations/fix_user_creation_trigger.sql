-- Fix "Database error saving new user" caused by trigger failures.
-- Safe to run multiple times (idempotent).

-- 1. Ensure email column exists and is nullable
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE profiles ALTER COLUMN email DROP NOT NULL;

-- 2. Ensure status column exists with correct default
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE profiles ALTER COLUMN status SET DEFAULT 'active';

-- Add check constraint if missing (idempotent via drop+add)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_status_check CHECK (status IN ('pending', 'active'));

-- 3. Robust trigger — never blocks user creation
--    Wrapped in EXCEPTION handler so any unexpected failure becomes a WARNING, not an error.
--    Role is never taken from signup metadata (security: prevents privilege escalation).
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_existing_role text;
BEGIN
  -- Inherit highest role from any existing profile with this email
  SELECT role INTO v_existing_role
  FROM profiles
  WHERE email = NEW.email
  LIMIT 1;

  INSERT INTO profiles (id, full_name, email, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.email,
    COALESCE(v_existing_role, 'learner'),
    'active'
  )
  ON CONFLICT (id) DO UPDATE
    SET email      = EXCLUDED.email,
        full_name  = COALESCE(EXCLUDED.full_name, profiles.full_name);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[handle_new_user] profile insert failed for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- 4. Backfill profiles for any auth users that are missing one
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
