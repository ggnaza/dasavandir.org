---
id: LP-009
entry_type: lesson
provenance: llm-reviewed
template-version: 1.0.0
maturity: seedling
status: active
severity: medium
module: action
type: false-belief
tags: [roles, enum, zod, validation, access-control, nextjs, gotcha]
created: 2026-08-21
last-modified: 2026-08-21
last-applied: 2026-08-21
superseded-by: null
---

# Adding a role (or any enum value threaded through validation) means updating EVERY validation site — grep the enum

## Question
When I add a new `role` value (or any string enum used across the app), is updating the UI selector and
the database CHECK constraint enough for it to work end to end?

## Claim (the lesson)
No. A role/enum is validated in more places than the obvious two. At minimum:
- the **UI** selector (`user-role-toggle.tsx`),
- the **DB** CHECK constraint (`profiles_role_check`),
- the **zod `z.enum([...])` on EVERY write endpoint** that accepts the value (create AND update — they are
  often different routes),
- any **`.in("role", [...])` read FILTER** that lists staff/records by role.

Miss one and the feature ships **broken in a way `tsc` cannot catch** — the string is valid TypeScript, so
the compiler is silent; the failure only appears at runtime as a 400/empty-list. Before merging any
role/enum change, `grep -rn` the enum members across `app/api` + the toggles + the fetch filters and
reconcile ALL of them. CLAUDE.md §Role-to-course-linking rule 2 covers the toggle but not the API enums —
treat the API enums as part of the same invariant.

## Evidence
2026-08-20/21 (WU-0010, the `space_manager` role) — shipped to prod with the toggle, the
`profiles_role_check` CHECK, and the create-route enum (`app/api/admin/users/create`) all updated. But the
role-**UPDATE** endpoint `app/api/admin/users/route.ts` still had
`z.enum(["admin","course_creator","course_manager","learner"])`, so the role toggle's POST 400'd with
"Failed to update role". The operator hit it in production; fixed in #290/#291 — which ALSO had to add
`space_manager` to that route's users-list `.in("role", [...])` filter (else space managers vanished from
the Users tab). Two separate misses in one file, both invisible to `tsc`.
