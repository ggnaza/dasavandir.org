-- Attestation: per-test invitations and a frozen per-attempt deadline (ADR-0011).
--
-- 1. attestation_invites — which published tests a teacher (module_access member)
--    may see and take. Managers and admins see every test without rows here.
-- 2. attestation_attempts.deadline_at — set when an attempt starts, so editing a
--    test's time limit never changes the time of a teacher already in the test.
--    NULL means "no stored deadline": fall back to the test's current limit.
--
-- RLS on, no client policies: all access goes through the service role.
-- Idempotent — safe to re-run. Staging shares the production database.

CREATE TABLE IF NOT EXISTS public.attestation_invites (
  test_id    uuid NOT NULL REFERENCES public.attestation_tests(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invited_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  invited_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (test_id, user_id)
);

CREATE INDEX IF NOT EXISTS attestation_invites_user_idx ON public.attestation_invites (user_id);

ALTER TABLE public.attestation_invites ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attestation_invites TO service_role;

ALTER TABLE public.attestation_attempts ADD COLUMN IF NOT EXISTS deadline_at timestamptz;
