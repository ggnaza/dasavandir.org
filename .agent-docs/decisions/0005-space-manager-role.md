---
provenance: llm-draft
status: proposed
template-version: 1.0.0
created: 2026-08-20
last-modified: 2026-08-20
work-unit: WU-0010
supersedes: []
superseded-by: null
related: [0001-role-to-course-access-via-three-link-tables, 0004-multi-tenancy-organizations-spaces-shopify-model]
tags: [architecture, roles, spaces, multi-tenancy, access-control]
---

# ADR-0005 — A `space_manager` role: "admin of a space", linked via `space_manager_access` (one level up from `course_manager`)

## Context
With spaces now the audience boundary inside an org (ADR-0004), the operator wants a role that is
**admin of a space**: it sees and manages *every* course in the space(s) it administers — courses,
learners, submissions, all the data — and can **create** courses in the space. This is distinct from
`course_manager` (scoped to individually-assigned courses) and from `admin` (the whole org). It sits one
level up from `course_manager`: space instead of course.

The app already models "role gates the console + a dedicated link table says which courses" strictly
(ADR-0001, CLAUDE.md §Role-to-course linking): `course_creator`→`course_creator_access`,
`course_manager`→`course_manager_access`, `learner`→`enrollments`. A new role must fit that discipline or
it silently breaks visibility.

## Alternatives Considered
- **No new role — reuse `space_members.role = 'manager'`** (a space member with an elevated role).
  Tempting (no new table), but **rejected**: it overloads `space_members`, which exists for *learner
  audience membership*, mixing two different relationships in one table — exactly the "wrong table
  silently breaks visibility" failure ADR-0001 warns against. It also can't gate the console: the admin
  layout gates on `profiles.role`, and a manager whose `profiles.role='learner'` wouldn't be admitted.
- **Grant space managers `admin`** (org-wide). **Rejected** — no space isolation; a space manager would
  see every org's/space's data. Defeats the purpose.
- **New role `space_manager` + a dedicated `space_manager_access(manager_id, space_id)` table** (chosen).
  Parallels `course_manager` + `course_manager_access` exactly, one level up. `profiles.role='space_manager'`
  gates the console; the table says which spaces; access to a course = "course's `space_id` ∈ my managed
  spaces". Keeps `space_members` purely for learners. Costs one small table + a 5th role threaded through
  the role toggle, the console gate, the course-fetch map, and the shared `checkCourseAccess` guard.

**Deciding axis:** fit the existing strict role→link-table model, gate the console by `profiles.role`,
and keep space isolation. Only the dedicated-table option satisfies all three.

## Decision
1. **Schema:** `space_manager_access (manager_id → profiles, space_id → spaces, granted_by, created_at,
   PK(manager_id, space_id))` + self-read RLS; `'space_manager'` added to the `profiles` role CHECK
   (idempotent drop+add). Migration `space_manager_access.sql`, hand-applied, staging-first.
2. **Access seam:** `lib/org.getManagedSpaceIds()`; `checkCourseAccess()` (`lib/assert-course-owner.ts`,
   the shared API + page guard) grants a space_manager access to any course whose `space_id` is in their
   managed spaces. This is the single seam every course-level page/route already routes through.
3. **Console:** `space_manager` is admitted by `app/admin/layout.tsx`, listed in the role toggle, gets a
   scoped nav (Courses only for now), and in `app/admin/courses/page.tsx` sees only their spaces' courses
   and subtabs. They can create (new course is stamped into their managed space so it is visible
   immediately) and edit/manage courses in their space.
4. **Assignment:** admins grant managed spaces via `POST/DELETE /api/admin/space-manager-access` +
   the (parameterised) `ManageSpacesModal` ("Managed spaces" action on space_manager users).
5. **Deferred (slice 2):** the GLOBAL aggregate views (`/admin/submissions`, `/admin/learners`,
   `/admin/analytics`, capstones) are NOT yet space-scoped — hence the Courses-only nav; a space manager
   operates through per-course pages meanwhile. Wire the space filter into those views before exposing
   them.

## Consequences
- **Good:** fits the established pattern, so the access story is one seam (`checkCourseAccess`), not a
  scattering of per-page role checks. Space isolation holds. `space_members` stays single-purpose.
- **Good:** inert-until-used — no existing user is `space_manager`, so deploying the code before the
  migration/role-assignment breaks nothing (verified: the new table is only queried for that role).
- **Bad / watch:** it is a 5th role that must be threaded consistently (CLAUDE.md §Role-to-course linking
  updated). Every NEW course-level admin view must route through `checkCourseAccess` (not an ad-hoc
  `role==='admin'` check) or a space manager is silently locked out — or, worse, a global view leaks
  cross-space data until slice 2 scopes it.
- **Migration hand-applied** (`memories/migrations-applied-by-hand.md`); verify against the live DB.

## Related
`CLAUDE.md` §Role-to-course linking (updated with the `space_manager` row + fetch branch + the slice-2
deferral); ADR-0001 (the strict role→link-table model this extends); ADR-0004 (spaces); WU-0010.
