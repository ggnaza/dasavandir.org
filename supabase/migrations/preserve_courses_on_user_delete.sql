-- ============================================================
-- Preserve courses when their creator is deleted
-- Changes courses.created_by FK from ON DELETE CASCADE (or RESTRICT)
-- to ON DELETE SET NULL so courses survive user deletion.
-- ============================================================

-- Drop the existing FK constraint (name may vary — drop both common variants)
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_created_by_fkey;
ALTER TABLE courses DROP CONSTRAINT IF EXISTS fk_courses_created_by;

-- Re-add with SET NULL so deleting a user keeps their courses
ALTER TABLE courses
  ADD CONSTRAINT courses_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES profiles(id)
  ON DELETE SET NULL;
