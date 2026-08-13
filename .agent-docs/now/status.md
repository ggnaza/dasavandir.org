---
provenance: llm-reviewed
created: 2026-07-03
last-modified: 2026-08-13
tags: [current, status, courses, phases]
related: [work-plan, open-questions, handoff]
---

# Status — dasavandir.org · Course phases (TLA → Regional Orientation) shipped to prod · 2026-08-13

## TL;DR
Built and shipped **course phases** (ADR-0003): a single course can run in ordered phases so the same
learners are re-divided into new groups with new moderators for a later stage without losing the first
stage's data. For TLA: **Phase 1 = TLA**, **Phase 2 = Regional Orientation**. Live on **production**
(`main` @ `6ac0a2f`) and **staging** (`c00cae0`). The migration `course_phases.sql` was applied to prod
by the operator; the 9 `ՏԿ | ԻՈՒ` lessons are tagged Regional Orientation, the rest TLA. A follow-up
(multi-select add-members) also shipped to prod (#274).

## Branch / working tree
- Local working tree is still on **`fix/rls-recursion-and-auth-hardening`** (based on the timetable
  branch `614abc3`) — the SAME stale tree from the previous session. All course-phases work happened in
  **separate worktrees off `origin/staging` and `origin/main`**, already merged + removed. ⚠️ This local
  branch must NOT be PR'd to main (drags in the timetable feature).
- ✅ **Store reconciled onto `main`** (2026-08-13, `docs/reconcile-agent-docs`): the previously-split
  store (ADR-0002 + RLS memory + LP-003/004/005 lived only in the local working tree; ADR-0003 only on
  main) was unioned onto `origin/main` — decisions 0001/0002/0003, lessons LP-001…005, 5 memories, and
  current `now/*`. The stale `fix/rls-*` local branch is no longer the source of truth; treat `main` as
  canonical and update the store from a main-based worktree going forward.

## What shipped this session (all on prod `main`)
- `931a1bb` (#273) — course phases feature (cherry-picked from staging #272 onto main's RLS fix).
- `6ac0a2f` (#274) — multi-select add-members in the groups manager.
- Prod DB: `course_phases.sql` applied (additive, transaction-wrapped); TLA phases seeded; existing
  groups moved to the TLA phase; 9 `ՏԿ | ԻՈՒ` lessons tagged Regional Orientation.

## Build / test state
- Gate here is **`tsc --noEmit`** (the exact type-check `next build` runs; `next.config` has no
  `ignoreBuildErrors`). Clean on both the staging-based and main-based worktrees before each merge.
- **No ESLint / Prettier configured in this repo** — type-check is the only static gate. Do not expect
  `next lint` to work (it prompts for setup).
- `next build` in an env-less worktree OOM-crashed (SIGABRT worker) — an environment artifact, NOT a
  code error. The real `next build` runs on the Vercel deploy.

## The drift that bit us (READ before any future migration)
The live DBs were bootstrapped from `staging-setup.sql`, and **staging ≠ prod**. **Staging is missing the
entire groups feature** (`course_groups`, `course_group_members`, `moderator_cohort_assignments`) — it
only has core tables (courses/lessons/assignments/submissions/profiles). Prod has the groups feature.
This is why the phases work went straight to **prod** (staging can't host the test) and why the migration
first failed on staging with `42P01: relation "course_groups" does not exist`.
