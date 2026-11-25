-- Voluntary-attestation tests (ADR-0010).
--
-- Native questions (markdown + KaTeX, optional figure), a mechanically imported
-- answer key, and attempts graded to a percentage that only staff can see.
--
-- RLS is enabled on every table with NO client policies: all reads and writes go
-- through API routes using the service-role client, which also enforces the
-- module_access check. Teachers must never read correct answers or results.
--
-- Idempotent — safe to re-run. Staging shares the production database, so this is
-- a production change.

-- ============================================================
-- 1. Allow 'attestation' in module_access
-- ============================================================
ALTER TABLE public.module_access DROP CONSTRAINT IF EXISTS module_access_module_check;
ALTER TABLE public.module_access
  ADD CONSTRAINT module_access_module_check
  CHECK (module IN ('courses', 'efficacy', 'gnahatum', 'attestation'));

-- ============================================================
-- 2. Tests
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attestation_tests (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject            text NOT NULL,
  title              text NOT NULL,
  year               text,
  description        text,
  status             text NOT NULL DEFAULT 'draft',
  time_limit_minutes integer,
  max_attempts       integer NOT NULL DEFAULT 1,
  source_note        text,
  created_by         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.attestation_tests DROP CONSTRAINT IF EXISTS attestation_tests_status_check;
ALTER TABLE public.attestation_tests
  ADD CONSTRAINT attestation_tests_status_check CHECK (status IN ('draft', 'published', 'archived'));

ALTER TABLE public.attestation_tests DROP CONSTRAINT IF EXISTS attestation_tests_max_attempts_check;
ALTER TABLE public.attestation_tests
  ADD CONSTRAINT attestation_tests_max_attempts_check CHECK (max_attempts >= 1);

-- ============================================================
-- 3. Shared passages / setups (one stimulus, several questions)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attestation_passages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id    uuid NOT NULL REFERENCES public.attestation_tests(id) ON DELETE CASCADE,
  label      text,
  body       text NOT NULL DEFAULT '',
  image_path text,
  position   integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS attestation_passages_test_idx ON public.attestation_passages (test_id);

-- ============================================================
-- 4. Questions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attestation_questions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id      uuid NOT NULL REFERENCES public.attestation_tests(id) ON DELETE CASCADE,
  passage_id   uuid REFERENCES public.attestation_passages(id) ON DELETE SET NULL,
  position     integer NOT NULL DEFAULT 0,
  number       text NOT NULL,
  answer_type  text NOT NULL,
  prompt       text NOT NULL DEFAULT '',
  options      jsonb NOT NULL DEFAULT '[]'::jsonb,
  match_slots  jsonb NOT NULL DEFAULT '[]'::jsonb,
  image_path   text,
  correct      jsonb,
  points       numeric NOT NULL DEFAULT 1,
  scoring      text NOT NULL DEFAULT 'all_or_nothing',
  needs_review boolean NOT NULL DEFAULT false,
  review_note  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.attestation_questions DROP CONSTRAINT IF EXISTS attestation_questions_type_check;
ALTER TABLE public.attestation_questions
  ADD CONSTRAINT attestation_questions_type_check
  CHECK (answer_type IN ('single', 'multi', 'order', 'match', 'numeric', 'short_text'));

ALTER TABLE public.attestation_questions DROP CONSTRAINT IF EXISTS attestation_questions_scoring_check;
ALTER TABLE public.attestation_questions
  ADD CONSTRAINT attestation_questions_scoring_check
  CHECK (scoring IN ('all_or_nothing', 'partial'));

ALTER TABLE public.attestation_questions DROP CONSTRAINT IF EXISTS attestation_questions_points_check;
ALTER TABLE public.attestation_questions
  ADD CONSTRAINT attestation_questions_points_check CHECK (points > 0);

CREATE INDEX IF NOT EXISTS attestation_questions_test_idx ON public.attestation_questions (test_id, position);

-- ============================================================
-- 5. Attempts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attestation_attempts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id      uuid NOT NULL REFERENCES public.attestation_tests(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'in_progress',
  answers      jsonb NOT NULL DEFAULT '{}'::jsonb,
  item_results jsonb,
  score        numeric,
  max_score    numeric,
  percent      numeric,
  started_at   timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.attestation_attempts DROP CONSTRAINT IF EXISTS attestation_attempts_status_check;
ALTER TABLE public.attestation_attempts
  ADD CONSTRAINT attestation_attempts_status_check CHECK (status IN ('in_progress', 'submitted'));

CREATE INDEX IF NOT EXISTS attestation_attempts_test_idx ON public.attestation_attempts (test_id);
CREATE INDEX IF NOT EXISTS attestation_attempts_user_idx ON public.attestation_attempts (user_id, test_id);

-- At most one open attempt per user per test.
CREATE UNIQUE INDEX IF NOT EXISTS attestation_attempts_one_open_idx
  ON public.attestation_attempts (user_id, test_id) WHERE status = 'in_progress';

-- ============================================================
-- 6. Atomic answer merge (autosave)
-- ============================================================
-- Two overlapping autosaves must not overwrite each other. Merging inside one
-- UPDATE (answers || patch, minus cleared ids) makes each save atomic. Only the
-- service role may call it: it takes the user id as a parameter.
CREATE OR REPLACE FUNCTION public.attestation_merge_answers(
  p_attempt uuid,
  p_user    uuid,
  p_patch   jsonb,
  p_remove  text[]
) RETURNS boolean
LANGUAGE sql
AS $$
  UPDATE public.attestation_attempts
     SET answers    = (answers || p_patch) - p_remove,
         updated_at = now()
   WHERE id = p_attempt
     AND user_id = p_user
     AND status = 'in_progress'
  RETURNING true;
$$;

REVOKE ALL ON FUNCTION public.attestation_merge_answers(uuid, uuid, jsonb, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.attestation_merge_answers(uuid, uuid, jsonb, text[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.attestation_merge_answers(uuid, uuid, jsonb, text[]) TO service_role;

-- ============================================================
-- 7. RLS — service role only
-- ============================================================
ALTER TABLE public.attestation_tests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attestation_passages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attestation_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attestation_attempts  ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 8. Private bucket for question figures
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('attestation', 'attestation', false)
ON CONFLICT (id) DO NOTHING;
