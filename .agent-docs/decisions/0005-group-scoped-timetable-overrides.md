---
provenance: llm-reviewed
status: accepted
template-version: 1.0.0
created: 2026-07-15
last-modified: 2026-07-15
work-unit: WU-0004
supersedes: []
superseded-by: null
related: [0003-app-enforced-course-visibility, ../reference/course-visibility-model.md]
tags: [timetable, groups, moderators, rls, import]
---

# ADR-0005 — Group-scoped timetable: creator-ticked slots, moderator overrides

## Context
`timetable_entries` is flat per-course (`supabase/migrations/timetable.sql`): one agenda for every
enrolled learner. TLA 2026 runs 5 real groups (`course_groups`, 13–17 members each, every one with a
`moderator_id`), and parts of the agenda genuinely differ per group — a team hour has a different topic
and room per group, some sessions don't apply at all.

The source of truth today is a Google Sheet, not the app. Its 5 tabs (3 weeks + 2 camps) parse cleanly
to **340 entries across 29 days**: dates on row 4 of every tab, day columns stepping by 3, time column
immediately left, emoji prefixes acting as type markers. The app's copy is stale and partial (7 entries
for 2026-07-02 where the sheet has 10).

Two facts constrain the permission design:
- All 5 group moderators hold the `course_manager` role, and `timetable.sql` already grants
  `course_manager` **`FOR ALL`** on the whole course timetable. Any moderator can already rewrite
  everyone's schedule. "Moderators adjust their own group" is convention, not enforcement.
- TLA has 9 `course_manager_access` rows but only 5 group moderators — **manager ≠ moderator**.

## Alternatives Considered
- **Nullable `group_id` only; an entry is either shared or group-specific** — rejected. It cannot
  express "modify this shared slot for my group": the base entry keeps rendering alongside the
  group-specific one. This is the majority of what was actually asked for, so the model fails the
  primary use case.
- **Full copy per group at import (340 × 5 ≈ 1,700 rows), each group's agenda independent** — rejected.
  Permissions become trivial (scope by `group_id`) but there is no shared base: a creator fixing a time
  in "the agenda" either clobbers every moderator's edits or must be re-applied five times by hand. The
  divergence is silent and unbounded. Simplicity at the write path buys a maintenance trap.
- **Moderators may override any slot (no tick)** — rejected by the operator. Defaults to
  moderators-can-touch-everything; the tick inverts it so the creator explicitly unlocks what is
  negotiable. Same reasoning as default-deny elsewhere in this codebase.
- **Store overrides as a JSON patch column on the base entry** — rejected. Un-queryable per group, no
  FK integrity to `course_groups`, no per-row RLS, and no clean way to audit who changed what.

## Decision
Base entries + per-group override rows, with a creator-controlled per-entry tick gating who may
override.

- `timetable_entries.moderator_adjustable boolean NOT NULL DEFAULT false` — the tick. Default-deny.
- `timetable_entries.group_id uuid NULL REFERENCES course_groups(id)` — `NULL` = shared base;
  non-null = a group-only addition owned by that group's moderator.
- `timetable_entry_overrides (entry_id, group_id, <nullable patch fields>, hidden, updated_by)`,
  `UNIQUE (entry_id, group_id)`. A `NULL` patch field inherits the base; `hidden = true` drops the slot
  for that group.

Resolution for a learner in group G: base rows where `group_id IS NULL OR group_id = G`, left-joined to
overrides for G; drop `hidden`; otherwise `COALESCE(override.field, base.field)`. A learner in no group
sees the shared base only.

RLS is tightened so a group moderator may write an override only where
`moderator_adjustable = true` **and** they moderate that group.

Settled by the operator, 2026-07-15:
- **Base ownership narrows to `admin` + `course_creator`.** `course_manager` becomes read-only on the
  timetable *unless* they moderate a group, in which case they additionally get override rights on
  ticked slots for that group only. This revokes base write from all 9 TLA managers (5 regain scoped
  override); it is a deliberate reduction of a live role's access.
- **On divergence, the override wins silently.** A creator's edit to a base field applies to every group
  that has not overridden that entry; an overriding group keeps its version and is not notified. Chosen
  for least build; the cost is that a creator can move a session and one group never hears about it.
  Revisit if that bites (a `base_changed_at` vs `override.updated_at` comparison is the cheap upgrade
  path — no schema change needed to add the flag later).

## Consequences
- A creator's edit to an un-overridden slot still propagates to every group — the property Model C
  cannot offer, and the reason the extra join is worth paying for.
- **The daily cron must resolve per group.** `app/api/cron/daily-timetable/route.ts` posts one agenda to
  all enrolled learners. Left alone, learners would receive an email contradicting their in-app view.
  This is required work, not a follow-up.
- **Import must be idempotent against a stable key or overrides orphan.** Overrides FK to
  `entry_id`; a re-import that does DELETE+INSERT, or that keys on a mutable field like `title`, silently
  destroys every moderator's adjustment. Import must UPDATE in place against a stable source key and
  show a diff preview before writing.
- The existing `course_manager FOR ALL` timetable policy must be narrowed. This is a permission
  reduction for a live role — it needs an explicit call on what non-moderator managers keep (see OQ).
- Attendance (`app/admin/courses/[id]/attendance/page.tsx`) reads entries directly and is group-blind;
  it will show the unresolved base until updated.

## Open questions
- Do moderator-added group-only slots need the creator's approval, or is the tick only about overrides?
  (Leaning: tick gates overrides only; a group-only addition is the moderator's own row and needs no
  approval — but this is unconfirmed.)
- **Assignments in the learner analytics panel — DEFERRED by the operator, 2026-07-15.** Explicitly
  "not yet, we come back to you", so this is parked, not dropped. The findings, so they are not
  re-derived: 9 assignments / 347 submissions on TLA 2026 (54% of a possible 648); `ai_total_score` on
  346 of 347, instructor `final_score` on only 36. `final_score` carries NO independent signal — the
  review UI pre-fills it from the AI score (`submission-reviewer.tsx:94`), and all 36 rows with both
  are byte-identical (mean delta 0.0). Scores are NOT on one scale: rubric maxima are 9 (×8), 10 (×2),
  16 (×1), so raw scores cannot be averaged across assignments without normalising by `max_score`.
  The usable metric is submission COUNT, not score — and its distribution is sharply bimodal: 11 of 72
  learners have submitted nothing, 38 sit on exactly 7 of 9. `max_score` is backfilled by
  `learner_analytics.sql`, which unblocks the score path whenever this is picked back up.
- ~~Attendance group-awareness~~ — **out of scope** (operator, 2026-07-15). Attendance keeps reading the
  unresolved base agenda. Revisit only if it misreports once groups are live.
