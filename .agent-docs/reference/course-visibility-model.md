---
provenance: human
template-version: 1.0.0
created: 2026-07-06
last-modified: 2026-07-06
related: [architecture-overview, ../memories/learner-auto-enroll-exposes-internal-wip-courses.md]
tags: [visibility, enrollment, rls, courses]
---

# Course visibility model (per-surface enforcement)

**What-it-is:** Course visibility is enforced in APP CODE, not RLS (ADR-0003). Learner-facing pages
read `courses` with the service-role `createAdminClient()` (bypasses RLS); RLS on `courses` is
default-deny, so there is no SELECT policy doing the filtering — app code must.

**Policy:** learners see only courses they are ENROLLED in. `"Draft" = published=false`; all learner
queries filter `published=true`, so true drafts don't leak — but published-but-unfinished courses
appear anywhere enrollment isn't ALSO checked.

**Per-surface status:**
- `/learn` (dashboard) — fetches published, filters to enrolled ✅
- `/learn/progress` — was leaking ALL published course titles to every learner; fixed 2026-07 to
  filter by enrollment ✅
- `/learn/courses/[id]` — gates on enrollment; redirects non-enrolled (private/internal → `/learn`,
  public → `/courses`) ✅
- `/courses` + `/courses/[id]` — PUBLIC marketplace: all `published=true` non-private/non-internal
  courses to anyone, by design (drives self-signup). Tension with enrolled-only — see the open question.

**Auto-enroll gotcha:** `/learn/page.tsx` auto-enrolls every `@teachforarmenia.org` user into ALL
`internal` + `published` courses → internal WIP exposed to TFA staff on publish
(memories/learner-auto-enroll-exposes-internal-wip-courses).

**Scope:** every learner-facing course surface. **Evidence:** the `/learn/progress` leak fix (2026-07).
**Last-verified:** 2026-07-06.
**See also:** ADR-0003 · [[project-course-visibility]]
