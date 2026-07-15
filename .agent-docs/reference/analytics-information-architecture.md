---
provenance: human
template-version: 1.0.0
created: 2026-07-06
last-modified: 2026-07-06
related: [time-on-task-tracking]
tags: [analytics, ia, admin, tabs]
---

# Course analytics information architecture

**What-it-is:** course admin analytics, consolidated 2026-07 (previously scattered/duplicated across
Learners/Progress/Gradebook/Analytics).

**Structure:**
- **Learners** (People → Learners) — roster, completion %, time spent, enroll/unenroll.
- **Progress** — completion matrix + time per lesson.
- **Analytics** is a sub-tab GROUP:
  - **Gradebook** (default, `/admin/courses/[id]/analytics`) — scores per learner (quiz avg,
    assignment avg, overall, completion). Old `/gradebook` redirects here; `gradebook-table.tsx` still
    lives in `gradebook/` and is imported by the analytics page.
  - **Quizzes** (`/analytics/quizzes`) — per-quiz completion/avg, per-question success + distractors,
    at-risk learners.
  - **Reflections** (`/analytics/reflections`) — learner journal entries (read via service role).
- **AI Coach → Usage** (`/ai-coach/usage`) — engagement, the AI's per-learner memory summaries,
  platform activity (time + last active).

`analytics-tabs.tsx` (old client switcher) deleted; sub-tabs are real routes rendered by the course
layout.

**Not yet done:** per-learner wrong-quiz-answers; the audit trail stays platform-level.
**Scope:** course admin analytics surfaces. **Last-verified:** 2026-07-06.
**See also:** [[project-analytics-ia]] · reference/time-on-task-tracking
