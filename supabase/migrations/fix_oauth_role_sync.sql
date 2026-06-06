-- Fix OAuth role-sync: pick highest-priority role instead of arbitrary LIMIT 1,
-- and add an email index so the lookup is fast under concurrent OAuth logins.

-- Index for fast role-sync lookups by email
CREATE INDEX IF NOT EXISTS profiles_email_idx ON profiles (email);

-- Updated trigger: inherits the BEST role from any existing profile with the same email
-- IMPORTANT: outer EXCEPTION WHEN OTHERS ensures trigger never blocks user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_best_role text;
BEGIN
  -- Find the highest-priority role among all existing profiles with this email.
  -- Priority: admin(1) > course_creator(2) > course_manager(3) > learner(4)
  BEGIN
    SELECT role INTO v_best_role
    FROM profiles
    WHERE email = NEW.email
    ORDER BY
      CASE role
        WHEN 'admin'          THEN 1
        WHEN 'course_creator' THEN 2
        WHEN 'course_manager' THEN 3
        ELSE                       4
      END
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_best_role := NULL;
  END;

  INSERT INTO profiles (id, full_name, email, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.email,
    COALESCE(v_best_role, 'learner'),
    'active'
  )
  ON CONFLICT (id) DO UPDATE
    SET email     = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[handle_new_user] profile insert failed for user % (%): %',
    NEW.id, NEW.email, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
