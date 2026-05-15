-- ============================================================
-- FIX: Staff can upload PDFs to the lesson-documents bucket
--
-- The bucket exists but had no INSERT/UPDATE RLS policies, causing
-- "new-row violates row-level security policy" on PDF upload.
-- Run this in Supabase → SQL Editor
-- ============================================================

-- Allow staff to upload (INSERT) to lesson-documents
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
      AND schemaname = 'storage'
      AND policyname = 'Staff can upload lesson documents'
  ) THEN
    CREATE POLICY "Staff can upload lesson documents"
      ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'lesson-documents'
        AND EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid()
            AND role IN ('admin', 'course_creator', 'course_manager')
        )
      );
  END IF;
END $$;

-- Allow staff to replace existing lesson documents (upsert uses UPDATE)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
      AND schemaname = 'storage'
      AND policyname = 'Staff can update lesson documents'
  ) THEN
    CREATE POLICY "Staff can update lesson documents"
      ON storage.objects
      FOR UPDATE TO authenticated
      USING (
        bucket_id = 'lesson-documents'
        AND EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid()
            AND role IN ('admin', 'course_creator', 'course_manager')
        )
      );
  END IF;
END $$;

-- Allow staff to delete lesson documents
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
      AND schemaname = 'storage'
      AND policyname = 'Staff can delete lesson documents'
  ) THEN
    CREATE POLICY "Staff can delete lesson documents"
      ON storage.objects
      FOR DELETE TO authenticated
      USING (
        bucket_id = 'lesson-documents'
        AND EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid()
            AND role IN ('admin', 'course_creator', 'course_manager')
        )
      );
  END IF;
END $$;
