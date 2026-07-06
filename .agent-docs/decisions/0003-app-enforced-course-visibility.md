---
provenance: llm-reviewed
status: accepted
template-version: 1.0.0
created: 2026-07-06
last-modified: 2026-07-06
work-unit: WU-0001
supersedes: []
superseded-by: null
related: [0002-read-own-role-with-admin-client, ../reference/course-visibility-model.md]
tags: [visibility, rls, courses, enrollment]
---

# ADR-0003 — Course visibility is enforced in application code, not RLS

## Context
Every learner-facing page reads `courses` via the service-role `createAdminClient()`, which bypasses
RLS. RLS on `courses` is default-deny for anon/authenticated (a direct REST read returns zero rows).

## Alternatives Considered
- **Enforce visibility with RLS SELECT policies on `courses`** — rejected. The app already reads with
  the service role (to avoid the role-downgrade class of bug, ADR-0002), which bypasses RLS entirely;
  an RLS policy would give a false sense of protection while the real filtering happens (or fails to)
  in app code. Complex per-role SELECT policies are also hard to audit.
- **Mix: RLS for learners, service-role for staff** — rejected as inconsistent; two enforcement paths
  double the surface where a leak can hide.

## Prior art / reference
The `/learn/progress` leak (all published course titles shown to every learner), fixed 2026-07.

## Decision
Visibility is enforced in app code on top of default-deny RLS: learners see only ENROLLED courses;
`/courses` is a deliberately public marketplace of `published=true` non-private/non-internal courses.

## Consequences
- Single enforcement path (app code) — but it means EVERY new learner-facing surface must apply the
  enrollment filter itself; a surface that forgets it leaks published courses. The
  `reference/course-visibility-model.md` map lists the per-surface status.
- Tension: the public marketplace shows courses learners aren't enrolled in — revisit if browsing
  should be gated (see OQ in `now/open-questions.md`).

## Related
reference/course-visibility-model · ADR-0002 · memories/learner-auto-enroll-exposes-internal-wip
