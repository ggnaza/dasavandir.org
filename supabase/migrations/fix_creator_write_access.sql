-- ============================================================
-- FIX: Admins and course creators/managers can INSERT lessons
--      and upload course cover images via the browser client
-- Run this in Supabase → SQL Editor
-- ============================================================

-- ── 1. LESSONS table: INSERT + UPDATE + DELETE for staff ────

-- Allow admins/creators/managers to insert lessons
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lessons' AND policyname = 'Staff can insert lessons'
  ) THEN
    CREATE POLICY "Staff can insert lessons" ON lessons
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid()
            AND role IN ('admin', 'course_creator', 'course_manager')
        )
      );
  END IF;
END $$;

-- Allow admins/creators/managers to update lessons
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lessons' AND policyname = 'Staff can update lessons'
  ) THEN
    CREATE POLICY "Staff can update lessons" ON lessons
      FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid()
            AND role IN ('admin', 'course_creator', 'course_manager')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid()
            AND role IN ('admin', 'course_creator', 'course_manager')
        )
      );
  END IF;
END $$;

-- Allow admins/creators/managers to delete lessons
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lessons' AND policyname = 'Staff can delete lessons'
  ) THEN
    CREATE POLICY "Staff can delete lessons" ON lessons
      FOR DELETE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid()
            AND role IN ('admin', 'course_creator', 'course_manager')
        )
      );
  END IF;
END $$;

-- Allow admins/creators/managers to select lessons (needed by browser client)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lessons' AND policyname = 'Staff can select lessons'
  ) THEN
    CREATE POLICY "Staff can select lessons" ON lessons
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid()
            AND role IN ('admin', 'course_creator', 'course_manager')
        )
      );
  END IF;
END $$;

-- ── 2. STORAGE: course-covers bucket ────────────────────────

-- Allow staff to upload (INSERT) to course-covers
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
      AND schemaname = 'storage'
      AND policyname = 'Staff can upload course covers'
  ) THEN
    CREATE POLICY "Staff can upload course covers"
      ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'course-covers'
        AND EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid()
            AND role IN ('admin', 'course_creator', 'course_manager')
        )
      );
  END IF;
END $$;

-- Allow staff to update/replace existing course covers
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
      AND schemaname = 'storage'
      AND policyname = 'Staff can update course covers'
  ) THEN
    CREATE POLICY "Staff can update course covers"
      ON storage.objects
      FOR UPDATE TO authenticated
      USING (
        bucket_id = 'course-covers'
        AND EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid()
            AND role IN ('admin', 'course_creator', 'course_manager')
        )
      );
  END IF;
END $$;

-- Allow staff to delete course covers
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
      AND schemaname = 'storage'
      AND policyname = 'Staff can delete course covers'
  ) THEN
    CREATE POLICY "Staff can delete course covers"
      ON storage.objects
      FOR DELETE TO authenticated
      USING (
        bucket_id = 'course-covers'
        AND EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid()
            AND role IN ('admin', 'course_creator', 'course_manager')
        )
      );
  END IF;
END $$;

-- Allow anyone to read course covers (public bucket)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
      AND schemaname = 'storage'
      AND policyname = 'Anyone can read course covers'
  ) THEN
    CREATE POLICY "Anyone can read course covers"
      ON storage.objects
      FOR SELECT TO public
      USING (bucket_id = 'course-covers');
  END IF;
END $$;
