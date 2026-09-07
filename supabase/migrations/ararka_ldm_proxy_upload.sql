-- LDM (moderator) proxy upload: track who actually uploaded the scan
-- Idempotent migration

ALTER TABLE ararka.scans
  ADD COLUMN IF NOT EXISTS uploaded_by uuid REFERENCES public.profiles(id);
