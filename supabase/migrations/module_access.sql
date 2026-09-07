-- Per-module access control for dasavandir.org
--
-- Replaces three overlapping mechanisms with one table:
--   * profiles.modules text[]  — which modules a user could enter
--   * profiles.is_ldm boolean  — global LDM tick, only meaningful for Efficacy
--   * the implicit rule that course_manager/space_manager == LDM in Ararka
--
-- Neither old column is dropped here: the backfill reads them, and dropping a
-- column in the same migration that reads it makes the migration non-idempotent.
-- Drop them in a follow-up once staging and production are both on this table.
--
-- Idempotent — safe to re-run.

-- ============================================================
-- 1. Table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.module_access (
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  module     text NOT NULL,
  access     text NOT NULL DEFAULT 'member',
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, module)
);

ALTER TABLE public.module_access DROP CONSTRAINT IF EXISTS module_access_module_check;
ALTER TABLE public.module_access
  ADD CONSTRAINT module_access_module_check
  CHECK (module IN ('courses', 'efficacy', 'gnahatum'));

ALTER TABLE public.module_access DROP CONSTRAINT IF EXISTS module_access_access_check;
ALTER TABLE public.module_access
  ADD CONSTRAINT module_access_access_check
  CHECK (access IN ('member', 'ldm'));

CREATE INDEX IF NOT EXISTS module_access_user_id_idx ON public.module_access (user_id);
CREATE INDEX IF NOT EXISTS module_access_module_idx  ON public.module_access (module);

COMMENT ON TABLE public.module_access IS
  'One row per module a user may enter. access = member (learner/teacher) or ldm (leading role).';

-- ============================================================
-- 2. RLS — service role only, plus a self-read
-- ============================================================
ALTER TABLE public.module_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own module access" ON public.module_access;
CREATE POLICY "Users read own module access"
  ON public.module_access FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================
-- 3. Backfill from the old mechanisms
-- ============================================================

-- 3a. profiles.modules -> a member row per module ('ararka' becomes 'gnahatum')
INSERT INTO public.module_access (user_id, module, access)
SELECT p.id,
       CASE WHEN m = 'ararka' THEN 'gnahatum' ELSE m END,
       'member'
FROM public.profiles p,
     unnest(COALESCE(p.modules, ARRAY['courses'])) AS m
WHERE m IN ('courses', 'ararka', 'gnahatum', 'efficacy')
ON CONFLICT (user_id, module) DO NOTHING;

-- 3b. profiles.is_ldm was the Efficacy LDM tick.
-- Guarded: the column only exists where efficacy_schema.sql has been applied,
-- and an unguarded reference makes this whole migration fail with 42703.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_ldm'
  ) THEN
    EXECUTE $q$
      INSERT INTO public.module_access (user_id, module, access)
      SELECT id, 'efficacy', 'ldm'
      FROM public.profiles
      WHERE is_ldm
      ON CONFLICT (user_id, module) DO UPDATE SET access = 'ldm'
    $q$;
  END IF;
END $$;

-- 3c. Ararka let any course_manager/space_manager in as an LDM
INSERT INTO public.module_access (user_id, module, access)
SELECT id, 'gnahatum', 'ldm'
FROM public.profiles
WHERE role IN ('course_manager', 'space_manager')
ON CONFLICT (user_id, module) DO UPDATE SET access = 'ldm';

-- 3d. Everyone keeps Courses, which was the implicit default
INSERT INTO public.module_access (user_id, module, access)
SELECT id, 'courses', 'member'
FROM public.profiles
ON CONFLICT (user_id, module) DO NOTHING;

-- ============================================================
-- 4. New users get Courses automatically
-- ============================================================
CREATE OR REPLACE FUNCTION public.grant_default_module_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.module_access (user_id, module, access)
  VALUES (NEW.id, 'courses', 'member')
  ON CONFLICT (user_id, module) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block profile creation on a grant failure.
  RAISE WARNING 'grant_default_module_access failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_grant_modules ON public.profiles;
CREATE TRIGGER on_profile_created_grant_modules
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.grant_default_module_access();
