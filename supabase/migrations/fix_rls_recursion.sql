-- ============================================================
-- FIX RLS INFINITE RECURSION (42P17) ON profiles / access tables
-- Run in Supabase → SQL Editor. Idempotent — safe to re-run.
--
-- PROBLEM
--   Several RLS policies resolve the caller's role with an inline
--     exists (select 1 from profiles where id = auth.uid() and role = 'admin')
--   Because that subquery reads `profiles`, and `profiles` itself carries a
--   policy that reads `profiles` (staging-setup.sql:452 "Admins can view all
--   profiles"), Postgres detects a cycle and raises
--     42P17: infinite recursion detected in policy for relation "profiles"
--   for ANY authenticated (browser-client) read of profiles / enrollments /
--   course_creator_access / course_manager_access. This is why the whole app
--   was forced onto the service-role client and the authenticated-role RLS
--   layer is effectively inert. (See ADR-0002, OQ-007.)
--
-- FIX
--   A SECURITY DEFINER helper is_admin() reads `profiles` WITHOUT triggering
--   RLS (it runs as the function owner, which owns the table), so it cannot
--   recurse. Rewriting the 4 back-edge policies to call is_admin() breaks
--   every cycle. The boolean result is IDENTICAL to the old inline subquery,
--   so NO access decision changes — only the recursion goes away.
--
--   The 4 back-edges (verified against supabase/staging-setup.sql):
--     profiles              → "Admins can view all profiles"        (self-ref)
--     enrollments           → "Admins manage all enrollments"
--     course_creator_access → "Admins manage course creator access"
--     course_manager_access → "Admins manage course manager access"
-- ============================================================

-- 1. Non-recursive role helpers. SECURITY DEFINER + a fixed search_path so
--    the internal profiles read bypasses RLS and cannot be hijacked.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated, anon;

-- 2. Rewrite the 4 recursive back-edges to use the helper.
--    Policy names, command types, and semantics are preserved EXACTLY.
--    Wrapped in a single transaction so there is NEVER a window where a policy
--    is dropped-but-not-recreated (atomic: all four swap, or none do).
begin;

  -- profiles: the direct self-reference (the primary recursion source)
  drop policy if exists "Admins can view all profiles" on public.profiles;
  create policy "Admins can view all profiles" on public.profiles
    for select using (public.is_admin());

  -- enrollments
  -- DRIFT (OQ-008): production names this policy "Admins view all enrollments"
  -- (FOR SELECT), while staging had "Admins manage all enrollments" (FOR ALL).
  -- Drop BOTH names and recreate the production shape so this migration converges
  -- either environment onto the same non-recursive policy. Verified 2026-08-13
  -- against prod pg_policies.
  drop policy if exists "Admins manage all enrollments" on public.enrollments;
  drop policy if exists "Admins view all enrollments" on public.enrollments;
  create policy "Admins view all enrollments" on public.enrollments
    for select using (public.is_admin());

  -- course_creator_access
  drop policy if exists "Admins manage course creator access" on public.course_creator_access;
  create policy "Admins manage course creator access" on public.course_creator_access
    for all using (public.is_admin());

  -- course_manager_access
  drop policy if exists "Admins manage course manager access" on public.course_manager_access;
  create policy "Admins manage course manager access" on public.course_manager_access
    for all using (public.is_admin());

commit;

-- ============================================================
-- After applying, re-run the verification pack (Q2/Q3): the four policies
-- should now read is_admin(), and an authenticated SELECT on profiles must
-- no longer raise 42P17. Service-role access is unchanged (it bypasses RLS
-- either way), so existing server code is unaffected.
-- ============================================================
