---
provenance: llm-reviewed
status: accepted
template-version: 1.0.0
created: 2026-08-12
last-modified: 2026-08-12
work-unit: WU-0001
supersedes: []
superseded-by: null
related: [current-user-role-read-needs-admin-client]
tags: [architecture, roles, access-control, courses]
---

# ADR-0001 — User-to-course access is linked through three separate role-specific tables, never a single shared table

> **Retroactive record (backfilled 2026-08-12).** This decision predates the context store; it is
> captured here from `CLAUDE.md` and the codebase so future work does not re-litigate or re-break it.

## Context
Four roles need different relationships to a course: `admin` (all courses), `course_creator` (courses
they build), `course_manager` (courses they moderate), and `learner` (courses they are enrolled in).
Any code path that creates/updates a user with a `courseId` must attach that user to the course in a
way that the per-role course-fetch queries can see.

## Alternatives Considered
- **One shared `enrollments` table for everyone (role as a column)** — the runner-up, genuinely simpler
  (one insert path, one join). Rejected because course-fetch is keyed per role from a specific table;
  putting a `course_creator`/`course_manager` into `enrollments` makes them invisible to the
  creator/manager course queries with **no error** — a silent visibility break. This bug actually
  shipped from `app/api/admin/users/create/route.ts` and was fixed.
- **Three role-specific link tables** (chosen) — `course_creator_access` (`creator_id,course_id`),
  `course_manager_access` (`manager_id,course_id`), `enrollments` (`user_id,course_id`). Each role's
  visibility query reads exactly its own table.

**Deciding axis:** fail-loud vs fail-silent on a wrong-table attach. The shared table fails silently
(worst possible mode for access control); separate tables make "wrong role → wrong table" a structural
impossibility rather than a runtime guess.
**Flip-condition:** if visibility were ever driven by a single role-column query instead of per-role
table joins, the shared-table option would regain its simplicity advantage without the silent-break
cost.

## Prior art / reference
Standard role-specific association tables. The enforcement rule and the exact keys live in
`CLAUDE.md` §Role-to-course linking.

## Decision
Attach users to courses through the role's own table. Any code path accepting a `courseId` MUST branch
on role and insert into the correct table. The admin course-fetch (`app/admin/courses/page.tsx`)
branches: `admin` → all; `course_manager` → via `course_manager_access.manager_id`; `course_creator`
(and others) → via `course_creator_access.creator_id`. [code-verified: `CLAUDE.md` table +
`app/api/admin/users/create/route.ts` fix + `app/admin/courses/page.tsx` branch]

## Consequences
- **Good:** wrong-role attaches become structurally impossible to hide; each role's visibility is a
  simple, auditable single-table query.
- **Bad:** more tables and insert branches to keep in sync. Adding a new course-access role means: a
  new access table + its moderators/course-access API + a course-fetch branch + the role toggle
  (`app/admin/users/user-role-toggle.tsx`) + a users-page course action — before any UI ships.

## Related
`CLAUDE.md` §Role-to-course linking — DO NOT BREAK; `memories/current-user-role-read-needs-admin-client.md`;
WU-0001; ADR-0005 (group-scoped timetables, referenced in commit 0cd39f3 — predates this store).
