-- Module access control: which modules each user can access
-- Idempotent migration — safe to re-run

-- Add modules column to profiles (default: courses only)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS modules text[] NOT NULL DEFAULT '{courses}';

-- Ensure trigger handles the new column
-- (handle_new_user trigger already has EXCEPTION WHEN OTHERS, so missing default won't break signup)

COMMENT ON COLUMN public.profiles.modules IS
  'Array of module IDs the user can access: courses, ararka, efficacy';
