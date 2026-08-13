---
provenance: llm-reviewed
created: 2026-08-13
last-modified: 2026-08-13
tags: [current, handoff, session-state]
related: [status, work-plan, open-questions]
generator: /handoff
---

# Session handoff — READ FIRST (2026-08-13) · 🎯 Course phases (TLA → Regional Orientation) shipped to PROD

## Project in one paragraph
Bilingual (Armenian-default) LMS on Next.js + Supabase, Vercel (`ggnaza/dasavandir.org`; ship flow
feature→`staging`→`main`, but see the twist below). This session designed + shipped **course phases**
(ADR-0003): one course can run in ordered phases so the same learners are re-divided into new groups with
new moderators for a later stage without losing the first stage's data. For **TLA**: Phase 1 = **TLA**,
Phase 2 = **Regional Orientation**. It went **straight to production** (not staging-first) because staging
is missing the entire groups feature. Operator is now mid-setup on prod.

## Current state summary
| Item | State |
|---|---|
| Course phases feature | ✅ shipped — prod `main` (#273 + #274), staging (#272). ADR-0003 accepted. |
| Prod DB migration `course_phases.sql` | ✅ applied by operator (additive, tx-wrapped). |
| TLA phase setup on prod | ✅ 2 phases seeded; existing groups → TLA phase; 9 `ՏԿ \| ԻՈՒ` lessons → Regional Orientation. |
| Multi-select add-members | ✅ shipped prod (#274). |
| Operator's remaining setup | ⏳ grant `course_manager_access` to Regional moderators → assign to Regional groups → add learners. |
| Timetable | ⏳ hidden (nav only), pending rework — OQ-010. |

## Important context
- **The design + rationale:** `decisions/0003-course-phases-within-a-single-course.md` (ADR-0003) —
  **but it lives on `origin/main`, NOT on this local branch** (see traps). Reference by ID.
- **Model:** `course_phases (id, course_id, name, ord)` + nullable `lessons.phase_id` /
  `course_groups.phase_id`. One group per learner per **(course, phase)**. A course with **no phase rows
  behaves exactly as today** — every non-TLA course is untouched.
- **Moderator review scoping:** a moderator sees a submission iff the learner is in a group they moderate
  AND (`lesson.phase_id IS NULL` OR in their phases). Untagged lessons stay visible to all → no
  migration-day blackout. Reviewer attribution + submit-email + cron routed by the assignment lesson's
  phase (`lib/reviewer-map.ts` — `buildReviewerMap` keyed `user:course:phase` + `:*` wildcard,
  `resolveReviewer`).
- **Two-gate visibility for a moderator (told the operator):** being a group's moderator is not enough —
  they must ALSO have `course_manager_access` to the course (that's what `getCourseReviewers` gates the
  moderator dropdown on). Grant access first, then assign.
- **Gate = `tsc --noEmit`** only. **No ESLint / Prettier in this repo** (`next lint` prompts for setup).
  `next.config` has no `ignoreBuildErrors`, so the type-check IS the build's static gate.
- Auth invariants still load-bearing: `memories/auth-trigger-must-swallow-errors.md`,
  `memories/current-user-role-read-needs-admin-client.md`, `memories/migrations-applied-by-hand.md`.

## ⚠️ Anti-assumptions / traps (load-bearing)
1. **Staging is NOT a mirror of prod — it's missing the ENTIRE groups feature.** `course_groups`,
   `course_group_members`, `moderator_cohort_assignments` do not exist on staging (only
   courses/lessons/assignments/submissions/profiles do). Any migration touching them fails on staging with
   `42P01`. This is why phases shipped to prod. VERIFY live schema (table existence, not just policies)
   before any migration — repo ≠ live, staging ≠ prod. (OQ-008 sharpened; LP-005/LP-006 proposed.)
2. **ADR-0003 + `course_phases.sql` are on `origin/main`/`origin/staging`, NOT on this local branch.**
   `ls .agent-docs/decisions/` here shows only 0001, 0002. The local tree
   (`fix/rls-recursion-and-auth-hardening`) never received the phases merge. Don't "re-add" 0003 locally
   thinking it's missing — it's on prod.
3. **Do NOT PR this local branch to main.** It's based on the timetable branch (`614abc3`); merging it
   drags the timetable feature. All phases work was done in **separate worktrees off `origin/main` /
   `origin/staging`**, already merged + removed. Future prod work: branch off `origin/main`, cherry-pick,
   PR to main (that's what #273 did).
4. **`next build` OOM-crashed (SIGABRT) in the env-less worktree** — an environment artifact of running
   the Next build from a nested worktree resolving modules upward, NOT a code error. Use `tsc --noEmit`
   for the local gate; the real build runs on the Vercel deploy.
5. **Timetable is hidden, not hard-gated** — pages still resolve by direct URL; only nav links removed.
   Once a learner is in two groups, `resolved_timetable()`'s `LIMIT 1` picks arbitrarily. OQ-010.
6. **Client-component `useState` doesn't reset on `router.refresh()`** — derive effective values from
   props with a fallback (fixed `selectedPhase` in `groups-manager.tsx`). LP-005 proposed.

## Detour-chain (the side-quest stack)
MAIN: "let TLA re-group learners for a 2nd phase (Regional Orientation) without losing phase-1 data" →
design discussion (rejected separate-course + bare-smallint; chose `course_phases` table) → wrote ADR-0003
→ built the feature in a worktree off staging (migration, phases API, groups tabs, lesson phase dropdown,
phase-scoped submissions + reviewer-map, hid timetable) → merged to staging (#272) → **discovered staging
lacks the groups feature entirely** (migration `42P01`) → pivoted to prod: verified prod schema, operator
applied migration to prod, cherry-picked feature onto main (#273) → tagged lessons by title marker
`ՏԿ | ԻՈՒ` (module numbers were unreliable) → answered operator Qs on moderator visibility (two-gate:
course_manager_access + group moderator) → built multi-select add-members (#274) → this handoff. All
resolved; operator mid-setup on prod. Open follow-ups: OQ-009 (move-learner control), OQ-010 (timetable).

## Immediate next steps
No blocking dev work. Operator-side, on **prod**:
1. For each **Regional Orientation moderator**: grant `course_manager_access` to the TLA course (admin
   **Users** page → manage-courses for a `course_manager` / `AssignManagerCoursesModal`) BEFORE they'll
   appear in the group moderator dropdown. Then Groups → **Regional Orientation** tab → create group →
   pick moderator → add learners (multi-select).
2. Verify a Regional moderator sees exactly Regional submissions from their group's learners (offered).
3. Possible dev follow-up (OQ-009): a **"move learner between groups within a phase"** control — currently
   remove-then-re-add. Offered, not built.
4. Deferred: OQ-010 (timetable rework + hard-gate), OQ-008 (schema-drift ledger), OQ-007 (RLS stage 3).

**Reusable recipe — prod deploy from this session (verbatim):**
```
git worktree add -b <branch> <path> origin/main
# implement, then:
npx --no-install tsc --noEmit -p tsconfig.json    # the only local gate (no eslint/prettier)
git push -u origin <branch> && gh pr create --base main ... && gh pr merge <n> --squash --delete-branch
git worktree remove <path> --force
```
Cherry-pick path (when the commit already exists on staging): `git cherry-pick <sha>` onto a fresh
`origin/main` worktree, tsc, PR to main.

## Recent decisions made
| When | Decision | Rationale / ref |
|---|---|---|
| 2026-08-13 | Phases modelled inside ONE course via a `course_phases` table | Per-course phase names; no-phase courses unchanged. Rejected: separate course, bare smallint. ADR-0003. |
| 2026-08-13 | Moderator queue scoped per-phase (Option 2), untagged-lessons-visible-to-all | Operator chose clean handoff over see-everything; untagged fallback avoids migration-day blackout. |
| 2026-08-13 | Ship phases straight to PROD, not staging-first | Staging lacks the whole groups feature; operator authorised the prod path. |
| 2026-08-13 | Tag Regional lessons by title marker `ՏԿ \| ԻՈՒ`, not module number | Module numbers were unreliable ("something wrong with the list"). |

## Breadcrumbs / artifacts
- Worktrees used this session were removed after merge (`course-phases`, `course-phases-main`,
  `groups-multi-add`). Nothing left in a non-git tree.
- Scratch PR body: `<scratchpad>/pr-body.md` (ephemeral; content is captured in PR #272).
- Operator-run prod SQL (not committed — instance data): TLA phase seed, group→phase backfill, and the
  lesson tag update (`title LIKE 'ՏԿ | ԻՈՒ%'` → Regional, else TLA). Reproduced from this handoff if needed.

## Reading order
1. This handoff. 2. `now/status.md` (branch/drift detail). 3. `now/work-plan.md` (WU-0004 + immediate).
4. `now/open-questions.md` (OQ-008 sharpened, OQ-009, OQ-010). 5. `CLAUDE.md` (invariants).
6. ADR-0003 — **on `origin/main`** (`git show origin/main:.agent-docs/decisions/0003-course-phases-within-a-single-course.md`).
No newer `checkpoints/` sitrep exists.

## Recent commits (origin/main)
- `6ac0a2f` feat: multi-select add-members in the groups manager (#274)
- `931a1bb` feat: course phases (TLA / Regional Orientation) with per-phase groups & review (#272) (#273)
- `8a7f755` Merge #271 — RLS recursion fix (previous session)
- `598700d` fix(rls): break profiles RLS infinite recursion via SECURITY DEFINER is_admin()
- `566bd04` Merge #270 from staging

---
*How to refresh this file: `/handoff`.*
