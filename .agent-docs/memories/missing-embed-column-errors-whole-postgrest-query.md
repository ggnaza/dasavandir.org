---
provenance: llm-reviewed
template-version: 1.0.0
created: 2026-07-06
last-modified: 2026-07-06
related: [../lessons/verify-prod-schema-before-debugging-live-breakage.md]
tags: [supabase, postgrest, schema-drift, submissions]
---

# A missing column inside a PostgREST embed errors the WHOLE query and returns null

**Observed:** The Submissions page showed "No submissions yet" despite 139 pending. `assignments` has
**no `max_score` column in prod** (code read it in several places, nothing wrote it); a nested
`.select("embed(max_score,...)")` errored with Postgres `42703` and the whole query silently returned
null.
**Root cause:** PostgREST fails the entire request when any selected column is absent — it does not
partially resolve. Code that tested `!data?.length` (not `error`) read the failure as "empty".
**Workaround / fix (2026-07):** dropped `max_score` from the hot embeds + added
`add_assignment_max_score.sql`. Always check `error`, not just `!data?.length`.
**Avoid:** don't assume `!data` means "no rows" — a schema-drift error looks identical. Also: the prod
`progress` table is keyed by `(user_id, lesson_id)` and has **no `course_id` column** — filter/delete
progress by `lesson_id`, never `course_id` (bit the course-delete endpoint 2026-07; now tolerant of
`42703`/`42P01`).
**See also:** [[project-manual-migrations]] · lessons/verify-prod-schema-before-debugging-live-breakage
