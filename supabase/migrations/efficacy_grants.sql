-- Grant the efficacy schema to the roles PostgREST actually uses.
--
-- efficacy_schema.sql created a scoped `efficacy_rw` role and granted it
-- everything. Nothing connects as that role: `lib/efficacy/db.ts` uses the
-- service-role key, so PostgREST switches to `service_role`, which had no
-- USAGE on the schema. The symptom is a 403 from every efficacy table —
-- "permission denied for schema efficacy" — while the schema plainly exists
-- and is listed under Exposed schemas.
--
-- This is the same fix ararka_batch_corrections.sql applied to the ararka
-- schema for the same reason.
--
-- Idempotent — safe to re-run.

GRANT USAGE ON SCHEMA efficacy TO anon, authenticated, service_role;

-- Data access is service-role only: RLS is enabled on every efficacy table and
-- no policies are defined, so a direct anon/authenticated read returns nothing
-- anyway. Keeping the grant narrow means a leaked anon key cannot reach these
-- rows even if a policy is added carelessly later.
GRANT ALL ON ALL TABLES    IN SCHEMA efficacy TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA efficacy TO service_role;

-- Tables added by a later migration inherit the same grants.
ALTER DEFAULT PRIVILEGES IN SCHEMA efficacy
  GRANT ALL ON TABLES    TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA efficacy
  GRANT ALL ON SEQUENCES TO service_role;
