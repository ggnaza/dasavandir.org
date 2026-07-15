---
provenance: human
template-version: 1.0.0
created: 2026-07-06
last-modified: 2026-07-06
related: [analytics-information-architecture]
tags: [analytics, time-on-task, sessions]
---

# Lesson time-on-task tracking + clamp

**What-it-is:** "time spent" per learner sums `lesson_sessions` rows (one row = a reported chunk of
`duration_seconds`) across analytics/learners/progress/export. Distinct from `lessons.duration_seconds`
(intrinsic video length — never clamp that).

**Tracking (post-2026-07 fix):** `session-tracker.tsx` records ACTIVE time only — counts wall-clock
only while `document.visibilityState === 'visible'`, ignores gaps > 20s (throttled/asleep tab), pauses
after 5 min idle, flushes via 30s heartbeat + on hide/unload. Background/duplicate tabs no longer
accrue (the original bug counted idle open tabs up to a 24h cap → absurd durations).

**Clamp (on READ):** `lib/session-time.ts` `MAX_SESSION_ROW_SECONDS = 3600` + `clampSessionSeconds()`,
applied at EVERY read/aggregation site so pre-fix inflated rows display sanely without deleting raw
data. `api/lessons/session/route.ts` rejects a single insert > 3600s.

**Scope:** all analytics that show "time spent." **Note:** historical totals still include pre-fix
rows, each capped at 1h on read; a stronger cleanup would cap/delete the extreme raw rows.
**Last-verified:** 2026-07-06.
**See also:** [[project-time-on-task]] · reference/analytics-information-architecture
