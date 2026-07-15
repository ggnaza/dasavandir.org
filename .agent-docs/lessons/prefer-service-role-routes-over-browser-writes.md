---
id: LP-002
entry_type: lesson
provenance: llm-reviewed
template-version: 1.0.0
maturity: budding
status: active
severity: high
module: action
type: false-belief
tags: [rls, service-role, api-routes, supabase]
created: 2026-07-06
last-modified: 2026-07-06
last-applied: 2026-07-06
superseded-by: null
---

# Prefer service-role server routes over browser Supabase writes

## Question
A DB or storage write from the browser client fails silently/opaquely. Patch the RLS policy, or change
the flow?

## Claim (the lesson)
For mutations on this LMS, prefer a server-side API route using the service-role admin client (+ an
explicit ownership check like `assertCourseOwner`) over a direct browser Supabase write — because
browser writes depend on RLS and fail silently/opaquely, and RLS migrations lag prod.

## Evidence
Recurring storage-upload failures (missing bucket INSERT policy) fixed via the signed-URL server flow
(2026-07); the nav role-downgrade bug fixed by reading role with the admin client (ADR-0002).

## Trigger (when this fires)
"new row violates RLS" / "schema is invalid or incompatible" on a browser write · adding any
create/update/delete path · needing the current user's role.

## Failure mode
Opaque client-side failures, silent data loss, or users downgraded to `learner` when an RLS policy
drifts. Fixes via manual RLS migrations don't take effect until run by hand on prod.

## Mitigation / Action items
- Route mutations through `/api/...` with `createAdminClient()` + an ownership assert.
- When a browser write fails opaquely, suspect a missing RLS policy and convert to a service-role route
  rather than only writing a migration.
- Never read `role` from user metadata; keep the trigger's `EXCEPTION WHEN OTHERS` handler.

## Recurrence count
3+ (storage buckets, role reads, course-creator linkage) — evergreen-track.
