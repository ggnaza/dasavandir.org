---
id: LP-001
entry_type: lesson
provenance: llm-reviewed
template-version: 1.0.0
maturity: budding
status: active
severity: high
module: action
type: staleness
tags: [supabase, schema-drift, migrations, debugging]
created: 2026-07-06
last-modified: 2026-07-06
last-applied: 2026-07-06
superseded-by: null
---

# Verify prod actually has the table/column before debugging "works locally, breaks on live"

## Question
A feature works on the dev server but 500s or shows empty on production. Where do you look first?

## Claim (the lesson)
When code works locally but breaks on live, FIRST verify prod actually has the table/column the code
reads — because migrations here are applied by hand in the Supabase SQL editor (no auto-runner, no CI
step), so prod schema silently lags the codebase. Query the live REST API with the service-role key
before assuming a logic bug.

## Evidence
Two production outages in one session (2026-06-16): missing `ai_coach_sessions`/`ai_coach_messages`
tables 500'd the learner AI coach; `courses.ai_coach_instructions` shipped with no migration and
silently no-op'd. Missing `assignments.max_score` broke the Submissions page (2026-07).

## Trigger (when this fires)
"It works in `next dev` but not on dasavandir." · A PostgREST `42703` (undefined column) / `42P01`
(undefined table). · Adding code that reads a NEW table/column.

## Failure mode
A missing table/column throws uncaught (→ 500) or errors a whole embed query (→ silent null read as
"empty"). Hours lost debugging app logic that is actually correct.

## Mitigation / Action items
- Before pushing code that reads a new table/column, confirm an idempotent migration exists AND remind
  the user to run it in the SQL editor.
- Make sessions/history writes best-effort (never throw) so a missing table degrades gracefully.
- Query live Supabase (ref `mmkmsudwtrqdzehnfctx`) with the service role to confirm schema.
- Run `next build` (with `NODE_OPTIONS=--max-old-space-size=4096`) before pushing.

## Recurrence count
3+ (AI coach tables, ai_coach_instructions, max_score, progress.course_id) — evergreen-track.
