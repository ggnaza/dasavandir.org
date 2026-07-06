---
provenance: llm-reviewed
status: accepted
template-version: 1.0.0
created: 2026-07-06
last-modified: 2026-07-06
work-unit: WU-0001
supersedes: []
superseded-by: null
related: [0001-handle-new-user-trigger-must-swallow-errors, 0003-app-enforced-course-visibility, ../lessons/prefer-service-role-routes-over-browser-writes.md]
tags: [auth, rls, roles, production-invariant]
---

# ADR-0002 — Read the current user's own role/profile with the service-role admin client

## Context
RLS is enabled on `profiles`. The only self-read access is the `"Users read own profile"` policy.
Server code needs the logged-in user's role to render role-appropriate nav and gate admin routes.

## Alternatives Considered
- **Use the user-auth client + rely on the self-read RLS policy** — rejected. If that policy is ever
  dropped or altered, every user-auth read of `profiles` returns null and the nav silently downgrades
  the user to `learner`. This is exactly what made course_creators/course_managers and Google-OAuth
  admins "appear as learners" (the `app/learn/layout.tsx` nav-role bug).
- **Cache role in a JWT claim** — rejected for now: adds a sync-on-change burden and a staleness
  window on role changes; revisit only if admin-client reads become a bottleneck.

## Prior art / reference
The in-repo nav-role downgrade incident; Supabase service-role bypasses RLS by design.

## Decision
Server code that reads the logged-in user's own profile/role uses `createAdminClient()` (service
role), never the user-auth `createClient()`.

## Consequences
- Role reads are immune to RLS-policy drift — the class of "everyone looks like a learner" bug is gone.
- Cost: service-role reads bypass RLS, so this pattern is reserved for the user's OWN row; it is not a
  license to fetch arbitrary users' data without an explicit ownership check.

## Related
CLAUDE.md §Reading the current user's role · ADR-0001 · lessons/prefer-service-role-routes-over-browser-writes
