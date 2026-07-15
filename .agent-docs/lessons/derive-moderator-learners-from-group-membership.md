---
id: LP-003
entry_type: lesson
provenance: llm-reviewed
template-version: 1.0.0
maturity: budding
status: active
severity: medium
module: action
type: false-belief
tags: [moderator, course-manager, groups, cohort]
created: 2026-07-06
last-modified: 2026-07-06
last-applied: 2026-07-06
superseded-by: null
---

# A moderator's learner subset comes from GROUP membership, not `moderator_cohort_assignments`

## Question
Which learners should a course_manager (moderator) see across submissions/learners/progress?

## Claim (the lesson)
Derive a moderator's learner subset from the groups they own (`course_groups.moderator_id = them` →
`course_group_members.user_id`), not from `moderator_cohort_assignments` — the latter is never
populated by the group workflow, so deriving from it makes moderators see NOTHING.

## Evidence
Bug fixed 2026-07: list surfaces derived from `moderator_cohort_assignments` → moderators saw no
learners; fixed to group membership via `getModeratorCohort` in `app/admin/submissions/page.tsx`,
`.../[id]/learners/page.tsx`, `.../[id]/progress/page.tsx`.

## Trigger (when this fires)
Any staff surface that lists learners/submissions/progress for a course_manager.

## Failure mode
Moderators see nobody (or, from a wrong interim fix, ALL course learners — also wrong). Correct: empty
group set = moderator sees no learners.

## Mitigation / Action items
- Use `lib/get-moderator-cohort.ts` (`getModeratorCohort`): null for non-managers (see all), else the
  group-member ids (possibly empty → see nobody).
- Note `app/admin/cohort/page.tsx` still uses `moderator_cohort_assignments` by design (separate
  dashboard) — leave unless intentionally migrating to groups.

## Recurrence count
1 (fixed 2026-07) — budding.
