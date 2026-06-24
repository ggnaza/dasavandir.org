-- ============================================================
-- profiles: allow authenticated users to read their OWN row
-- Run this in Supabase → SQL Editor
-- ============================================================
--
-- Context / why this exists:
-- enable_rls_all_tables.sql + fix_rls_security.sql enabled RLS on `profiles`
-- with only two SELECT policies, both about OTHER users:
--   - "Managers view assigned course students"
--   - "Creators view their course students"
-- There was NO policy letting a user read their own profile row.
--
-- The app relied on reading the current user's own profile via the
-- user-auth (anon-key + JWT) Supabase client in places like
-- app/learn/layout.tsx (to compute the nav role). After RLS was enabled,
-- that read returned NULL, so course_creators, course_managers, and
-- Google-OAuth admins who land on /learn were silently shown the LEARNER
-- nav — i.e. "their role looked broken / they appeared as learners."
--
-- This policy lets any authenticated user SELECT only their own row.
-- It exposes no other user's data (id = auth.uid()), so it is safe and
-- does not weaken the privilege model.
--
-- Idempotent: drops the policy first if it already exists.

DROP POLICY IF EXISTS "Users read own profile" ON profiles;
CREATE POLICY "Users read own profile" ON profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());
