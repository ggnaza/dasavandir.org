-- Fix RLS security issues flagged by Supabase security scanner.
-- All three tables are accessed exclusively via createAdminClient() (service role)
-- for real DB operations, so enabling RLS with default-deny is safe.
-- Service role bypasses RLS unconditionally.

-- profiles: has 4 policies already but RLS was never enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ai_coach_sessions: was explicitly disabled in add_ai_coach_sessions.sql
ALTER TABLE public.ai_coach_sessions ENABLE ROW LEVEL SECURITY;

-- moderator_cohort_assignments: RLS was never enabled
ALTER TABLE public.moderator_cohort_assignments ENABLE ROW LEVEL SECURITY;
