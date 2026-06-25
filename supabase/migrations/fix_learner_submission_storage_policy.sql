-- ============================================================
-- FIX: Learners can upload assignment submission files
--
-- The lesson-files bucket is private with no INSERT policy for
-- authenticated users, so any learner file upload fails with a
-- storage RLS error ("Upload failed. Please try again.").
--
-- Path convention: submissions/{user_id}/{timestamp}-{filename}
-- We restrict uploads to the user's own subfolder.
-- Run this in Supabase → SQL Editor
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
      AND schemaname = 'storage'
      AND policyname = 'Learners can upload own submissions'
  ) THEN
    CREATE POLICY "Learners can upload own submissions"
      ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'lesson-files'
        AND (storage.foldername(name))[1] = 'submissions'
        AND (storage.foldername(name))[2] = auth.uid()::text
      );
  END IF;
END $$;
