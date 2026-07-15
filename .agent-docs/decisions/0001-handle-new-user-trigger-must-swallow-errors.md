---
provenance: llm-reviewed
status: accepted
template-version: 1.0.0
created: 2026-07-06
last-modified: 2026-07-06
work-unit: WU-0001
supersedes: []
superseded-by: null
related: [0002-read-own-role-with-admin-client, ../lessons/verify-prod-schema-before-debugging-live-breakage.md]
tags: [auth, supabase, trigger, production-invariant]
---

# ADR-0001 — The `handle_new_user()` trigger must swallow errors and never read role from metadata

## Context
A Postgres trigger on `auth.users` INSERT creates the matching `profiles` row
(`supabase/migrations/fix_user_creation_trigger.sql`). It runs inside Supabase's signup
transaction, so any error it raises aborts user creation. This has broken production more than once.

## Alternatives Considered
- **Let the trigger raise on failure** — rejected. A raise during user creation breaks BOTH email
  signup ("Database error saving new user") AND Google SSO (the OAuth callback returns no `code`,
  only `error_description`). A single NOT NULL column added without a default is enough to trip it.
- **Read `role` from `raw_user_meta_data`** — rejected. It is a privilege-escalation vector: an
  attacker sets `role=admin` in signup metadata and self-promotes.
- **Drop the trigger, create profiles only in app code** — rejected as the sole mechanism; kept as a
  defensive complement (see Consequences), but removing the trigger risks orphaned `auth.users` rows.

## Prior art / reference
Supabase's own auth-trigger guidance + two in-repo production incidents (email signup + SSO outage).

## Decision
The trigger body is wrapped in `EXCEPTION WHEN OTHERS` so any failure becomes a `RAISE WARNING`, not
a user-blocking error; it never reads `role` from metadata. Because it now warns silently, app code
**defensively upserts** into `profiles` after any auth flow (`ensureProfile()` in
`lib/auth/ensure-profile.ts`).

## Consequences
- Signup and SSO cannot be broken by a trigger failure; a missed profile is repaired by the app upsert.
- Cost: a silently-warning trigger can mask a real schema mismatch — so any `profiles` column change
  must update the trigger in the SAME migration, and a post-change smoke test (create a user in the
  Supabase dashboard) is mandatory.

## Related
CLAUDE.md §Auth · ADR-0002 · `lib/auth/ensure-profile.ts` · memories/next-build-typechecks-all-provider-branches
