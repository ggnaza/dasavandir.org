---
provenance: human
template-version: 1.0.0
created: 2026-07-06
last-modified: 2026-07-06
related: [../lessons/derive-moderator-learners-from-group-membership.md, course-visibility-model]
tags: [moderator, course-manager, groups, access]
---

# Moderator (course_manager) access model

**What-it-is:** two distinct layers.
1. **Course access gate** — a course_manager is granted a course via `course_manager_access` (created
   when an admin/creator "adds a moderator"); this is also what `assertCourseOwner` checks for managers.
2. **Learner subset (group-based)** — the learners a moderator SEES are the members of the groups they
   own: `course_groups.moderator_id = them` → `course_group_members.user_id`. There is no separate
   "assign moderator" UI; moderators create/own their own groups. The legacy
   `moderator_cohort_assignments` table is unioned for back-compat, but the group path is the real
   mechanism.

**Helper:** `lib/get-moderator-cohort.ts` `getModeratorCohort()` returns null for non-managers (see
all), else the group-member ids (possibly empty → see nobody).

**Scope:** staff surfaces listing learners/submissions/progress. **Evidence:** the 2026-07 fix
deriving from group membership across submissions/learners/progress pages.
**Caveat:** `app/admin/cohort/page.tsx` still uses `moderator_cohort_assignments` (separate dashboard),
left as-is.
**Last-verified:** 2026-07-06.
**See also:** lessons/derive-moderator-learners-from-group-membership · [[project-moderator-access]]
