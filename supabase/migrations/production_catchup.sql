-- ============================================================
-- PRODUCTION CATCH-UP — run once in production Supabase SQL Editor
-- ============================================================

-- 1. Fix handle_new_user trigger (adds EXCEPTION WHEN OTHERS so signup never fails)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_best_role text;
BEGIN
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- 2. Add access_type to courses
ALTER TABLE courses ADD COLUMN IF NOT EXISTS access_type text NOT NULL DEFAULT 'private'
  CHECK (access_type IN ('public', 'private', 'paid'));

UPDATE courses SET access_type = 'paid' WHERE is_paid = true;

-- 3. Add course_type to courses
ALTER TABLE courses ADD COLUMN IF NOT EXISTS course_type text NOT NULL DEFAULT 'program'
  CHECK (course_type IN ('program', 'internal'));
