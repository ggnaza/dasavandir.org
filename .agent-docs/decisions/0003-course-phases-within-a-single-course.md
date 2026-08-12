---
provenance: llm-reviewed
status: accepted
template-version: 1.0.0
created: 2026-08-13
last-modified: 2026-08-13
work-unit: WU-0004
supersedes: []
superseded-by: null
related: [0001-role-to-course-access-via-three-link-tables]
tags: [architecture, courses, groups, phases, moderators, submissions]
---

# ADR-0003 — A course runs in ordered *phases*; groups, moderators and assignment-review are scoped to a phase, not to the whole course

## Context
The Teacher Leadership Academy (TLA) course runs in two stages. Stage 1 ("TLA") has learners divided
into groups, each with a moderator. Stage 2 ("Regional Orientation") **re-divides the same learners into
new groups with new moderators**. The operator wants:

1. Stage-1 group data preserved (nothing lost).
2. Stage-2 groups to co-exist so the new moderators can review the new assignments.
3. A moderator's review queue scoped to their own stage (see the review-visibility axis below).
4. All learner data to stay in **one course** (explicit operator constraint — this is why "make it a
   separate course" is rejected below).

The blocker: the model today hard-assumes **one group per learner per course**. The group-members API
rejects a second group in the same course (`app/api/admin/groups/[groupId]/members/route.ts` — *"already
in a group for this course"*), and two consumers rely on that assumption — `lib/reviewer-map.ts` keys a
learner's reviewer as `user:course → one moderator`, and `resolved_timetable()` picks the learner's group
with `LIMIT 1`. So Stage-2 groups cannot simply be "added".

## Alternatives Considered
- **Model Regional Orientation as a separate course** (runner-up). Genuinely the lowest-code path: the
  entire model is already course-scoped, so a new course gives new groups/moderators/submissions with
  **zero schema change** and Stage-1 untouched. **Rejected** because the operator's explicit goal is to
  keep all learner data in a single course; two courses splits enrollment, progress, and the learner's
  course list across two shells. Flip-condition: if the operator ever prefers per-stage courses, this
  becomes the correct, cheaper option.
- **A bare `smallint phase` column on lessons + groups, phase names hardcoded in the UI** (the earlier
  lean; genuinely the smallest migration). **Rejected** once the naming requirement landed: the phase
  labels "TLA" / "Regional Orientation" are **course-specific**, and a `smallint` has nowhere to home a
  per-course name — it forces either hardcoded global labels (wrong for any second phased course) or a
  hidden per-course label map in code. It also can't answer "does *this* course use phases?" without a
  backfill that mutates every course's groups to `phase = 1`. Flip-condition: if phases were ever a fixed
  global 1/2 with the same names for all courses, the `smallint` regains its simplicity edge.
- **A first-class `course_phases` table** (chosen — `id, course_id, name, ord`). Homes per-course phase
  names correctly, and makes "does this course use phases?" a simple *"does it have phase rows?"* — so a
  course with **zero** phase rows behaves exactly as today with no backfill at all. Costs one small table
  + a way to create phase rows (an operator seed for TLA, plus a light add-phase affordance).
- **Phase the *lesson* vs phase the *assignment*.** Assignments hang off lessons and there is no
  module/section grouping to reuse, so the tag lives on the **lesson** and assignments inherit via
  `assignment → lesson`. Tagging assignments directly would duplicate the tag and let a lesson's
  assignments disagree on phase.
- **Filter moderator *visibility* by phase (hard wall) vs scope the *queue* (soft, with a shared
  fallback).** Chosen: scope the queue but let **untagged (`NULL`-phase) lessons remain visible to every
  moderator**. A hard wall would black-out existing TLA lessons the instant groups are phased but before
  lessons are hand-tagged — a migration-day regression. The soft fallback means a lesson becomes
  phase-scoped only once it is tagged; nothing goes dark.

**Deciding axis:** preserve-in-one-course + per-course phase names + zero-impact on non-phased courses +
no-regression-while-hand-tagging. The `course_phases` table (a course with no phase rows = today's
behaviour) + phase-scoped-queue-with-NULL-fallback is the point that satisfies all four.

## Decision
**A course runs in ordered phases; phase becomes the scoping unit that "course" currently is for groups.**
A phase is effectively a sub-course: same learners, re-divided, new moderators, its own assignments.

1. **Schema (additive, idempotent, mutates no existing lesson/submission/group/progress row):**
   - `course_phases (id uuid pk, course_id uuid fk→courses ON DELETE CASCADE, name text NOT NULL,
     ord int NOT NULL DEFAULT 1, created_at timestamptz)` with `UNIQUE (course_id, ord)`.
   - `lessons.phase_id uuid NULL REFERENCES course_phases(id) ON DELETE SET NULL` — `NULL` =
     untagged/shared (visible to every moderator).
   - `course_groups.phase_id uuid NULL REFERENCES course_phases(id) ON DELETE SET NULL`.
   - **No backfill in the committed migration** — a course with no phase rows is unchanged. TLA is seeded
     by a **separate, scoped operator step**: insert its two phases ("TLA" ord 1, "Regional Orientation"
     ord 2), then set that course's existing `course_groups.phase_id` to the TLA phase. Existing lessons
     stay `NULL` and are hand-tagged over time.

2. **One group per learner per `(course, phase_id)`** — the members API rejects a second group only
   within the *same* `phase_id` (treating `NULL` as its own bucket, which preserves the old
   one-per-course behaviour for every course with no phases). This is what lets a learner keep their TLA
   group *and* join a Regional Orientation group.

3. **A moderator's submissions queue is scoped to their phase(s), with a NULL fallback.** A moderator
   sees a submission iff the learner is in a group they moderate **and** (`lesson.phase_id IS NULL`
   **OR** `lesson.phase_id ∈ the phase_ids of the groups they moderate`). Admins / course-creators see
   everything.

4. **Reviewer attribution is phase-aware.** A submission's assigned reviewer = the moderator of the
   learner's group **in the assignment lesson's phase**. This drives both the "assigned reviewer" column
   and the submit-time notification email, so a Regional-Orientation submission routes to the
   Regional-Orientation moderator, not an arbitrary one.

5. **Timetable is hidden** (learner page, admin manager, nav links) pending a separate rework — because a
   learner now in two groups makes `resolved_timetable()`'s `LIMIT 1` pick a group arbitrarily. Hiding
   removes the surface rather than half-fixing it. Tracked as OQ (timetable rework must resolve the
   learner's group *within a phase* before it is re-exposed).

## Consequences
- **Good:** Stage-1 data is preserved by construction (additive migration, no row rewritten). New
  moderators inherit their stage's assignments the moment a lesson is tagged + the learner is grouped —
  no per-submission reassign. Non-phased courses behave exactly as today (`NULL` everywhere).
- **Good:** "clean handoff" semantics — a re-tagged lesson's submissions leave the old moderator's queue
  and land in the new one.
- **Bad / watch:** review visibility is now phase-scoped, so a Stage-1 moderator can **no longer** see
  Stage-2 work and vice-versa (operator chose this over "see everything"). The `NULL`-fallback is
  load-bearing: forgetting to tag a lesson leaves it visible to *all* moderators, not none — fail-open on
  visibility, which is the safe direction here (no privacy requirement).
- **Bad / watch:** the timetable is dark until reworked; do not re-expose it without per-phase group
  resolution.
- **Migration is hand-applied** (per `memories/migrations-applied-by-hand.md`); verify against the live
  DB, do not assume the repo file is what's live.

## Related
`CLAUDE.md` §Role-to-course linking (unchanged — phases do not add a role); ADR-0001 (link-table model);
`memories/migrations-applied-by-hand.md`; WU-0004.
