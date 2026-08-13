---
provenance: llm-reviewed
created: 2026-08-12
last-modified: 2026-08-12
related: [current-user-role-read-needs-admin-client, auth-trigger-must-swallow-errors, migrations-applied-by-hand]
tags: [rls, supabase, recursion, security, profiles]
---

# RLS policies recurse through `profiles` (42P17) — the authenticated-role layer is inert; the app survives on the service-role client

## Observed
Any authenticated (browser-client, anon-key + JWT) read of `profiles`,
`enrollments`, `course_creator_access`, or `course_manager_access` raises
`42P17: infinite recursion detected in policy for relation "profiles"`. It shows
up whenever someone tries to move a read/write OFF the service-role client and
ONTO the user-auth client (e.g. the Kaits course-publishing session, PR #261,
saving course settings — the fix routed it back through a service-role API).

## Root cause
`supabase/staging-setup.sql:452` defines `"Admins can view all profiles" ON
profiles USING (exists (select 1 from profiles ... role='admin'))` — a policy on
`profiles` that reads `profiles` (direct self-reference). Three more admin
policies read `profiles` from tables that `profiles`' "Creators/Managers view
students" policies read back into: `"Admins manage all enrollments"`,
`"Admins manage course creator access"`, `"Admins manage course manager access"`.
Postgres detects the cycle at plan time and errors.

## Workaround / fix
- **Historical workaround (still in force):** read via `createAdminClient()`
  (service role bypasses RLS). This is why virtually all DB access is service-role
  and why RLS provides no real defense-in-depth today.
- **Fix:** `supabase/migrations/fix_rls_recursion.sql` — a `SECURITY DEFINER`
  `is_admin()` helper (reads `profiles` without RLS) + rewrite of the 4 back-edge
  policies to call it. Semantically identical, non-recursive. See ADR-0002.

## Avoid
- Do NOT add a policy ON `profiles` whose `USING`/`WITH CHECK` reads `profiles`
  (or reads a table whose policy reads `profiles`). Use `is_admin()` /
  a `SECURITY DEFINER` helper instead.
- Do NOT assume the migrations in `supabase/migrations/` reflect prod — the live
  schema was bootstrapped from `supabase/staging-setup.sql`, which diverges from
  the incremental migrations. Verify against `pg_policies` before changing RLS.

## See also
ADR-0002 · `supabase/staging-setup.sql:451-455` · `group_timetables.sql:75-80`
(the earlier note about this) · OQ-007 (recursion fix pending) · OQ-008 (three
divergent schema sources) · memories/current-user-role-read-needs-admin-client.
