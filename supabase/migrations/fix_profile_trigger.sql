-- ⚠️ SUPERSEDED by consolidate_handle_new_user.sql — that file is the canonical
--    trigger. This file has been DEFUSED (below) but do not treat it as the
--    source of truth. Historically it (a) read role from raw_user_meta_data
--    (privilege escalation) and (b) lacked an outer EXCEPTION handler. Both are
--    now fixed here so a stray re-paste is harmless.
--
-- Run once in Supabase → SQL Editor

-- 1. Make email nullable (in case it was added as NOT NULL without a default)
ALTER TABLE profiles ALTER COLUMN email DROP NOT NULL;

-- 2. Ensure status has a default (idempotent with activation_flow.sql)
ALTER TABLE profiles ALTER COLUMN status SET DEFAULT 'active';

-- 3. Backfill email from auth.users for any profiles missing it
UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;

-- 4. Updated trigger: always sets email + status so new signups always get a profile
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_existing_role text;
BEGIN
  -- If another profile already exists with this email (e.g. prior email/password signup),
  -- inherit that role so OAuth logins don't lose admin/creator privileges.
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
    COALESCE(v_existing_role, 'learner'),   -- NEVER raw_user_meta_data->>'role' (privilege-escalation guard)
    'active'
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[handle_new_user] profile insert failed for user % (%): %',
    NEW.id, NEW.email, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Manually create profile for any auth users who have no profile yet
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
