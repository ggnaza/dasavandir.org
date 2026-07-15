-- REPAIR: actually revoke RPC execute from anon / authenticated
--
-- Apply by hand in the Supabase SQL editor. Idempotent; safe to re-run.
--
-- WHY THIS EXISTS
-- learner_analytics.sql and group_timetables.sql each did:
--
--   REVOKE ALL ON FUNCTION f(...) FROM PUBLIC;
--   GRANT EXECUTE ON FUNCTION f(...) TO service_role;
--
-- That does NOT achieve what it looks like. Supabase ships
-- `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,
-- authenticated`, so a newly created public function is granted EXECUTE to those
-- two roles EXPLICITLY. Revoking from PUBLIC does not touch an explicit per-role
-- grant, so both RPCs stayed callable by anyone holding the anon key.
--
-- Verified against production after applying group_timetables.sql:
--   POST /rest/v1/rpc/resolved_timetable    (anon key) -> HTTP 200
--   POST /rest/v1/rpc/course_learner_stats  (anon key) -> HTTP 500 (42P17)
-- Neither returned data — but only because both functions are SECURITY INVOKER, so
-- the caller's own RLS still applied. The REVOKE contributed nothing. Had either
-- been SECURITY DEFINER (as course_learner_stats originally was, before #254), this
-- would have been a live leak of every learner's activity on every course.
--
-- Defence in depth was doing the work alone. This restores the outer layer.

REVOKE ALL ON FUNCTION course_learner_stats(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION course_learner_stats(uuid) TO service_role;

REVOKE ALL ON FUNCTION resolved_timetable(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION resolved_timetable(uuid, uuid) TO service_role;

-- Verify after applying — both must be refused for the anon key:
--   POST /rest/v1/rpc/resolved_timetable    -> expect 404 (PGRST202), not 200
--   POST /rest/v1/rpc/course_learner_stats  -> expect 404 (PGRST202), not 500
