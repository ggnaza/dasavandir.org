---
id: LP-003
entry_type: lesson
provenance: llm-reviewed
template-version: 1.0.0
maturity: seedling
status: active
severity: high
module: action
type: false-belief
tags: [rls, supabase, migrations, drift, verification, security]
created: 2026-08-13
last-modified: 2026-08-13
last-applied: 2026-08-13
superseded-by: null
---

# On a hand-applied Supabase schema, the repo's `migrations/` is NOT the live schema — verify the live schema (policy names AND table existence) per environment before ANY migration

## Question
Before applying ANY migration (policy, trigger, or plain table/column change), can I trust the committed
migration files — or one environment's shape — to represent what's actually live in the target database?

## Claim (the lesson)
When migrations are applied by hand (no runner), verify the **live schema for the specific target
environment** before writing or applying anything. The repo's `migrations/` dir, `schema.sql`, and
`staging-setup.sql` can all disagree with each other AND with prod, and **staging ≠ prod**. Two distinct
failure shapes:
- **Policy no-op:** a fix built as `DROP POLICY IF EXISTS "<name>" … CREATE POLICY "<name>" …` **silently
  no-ops** if the live policy has a different name — leaving the bug in place with a green "Success".
- **Missing relation / whole feature:** an env may be **missing entire tables/features**. A migration that
  `ALTER`s or FK-references a table that doesn't exist there fails outright (`42P01`). Verify the target
  relations EXIST before authoring, not just their policies.

## Evidence
- 2026-08-13 (WU-0003) — the recursion fix was authored against `staging-setup.sql`, whose enrollments
  back-edge is `"Admins manage all enrollments"` (FOR ALL). Production's was `"Admins view all
  enrollments"` (FOR SELECT); the staging-authored `DROP` would have matched nothing in prod, leaving
  `enrollments` recursing while reporting success. Prod also had a different trigger + was missing two
  `Managers view …` policies staging had. (ADR-0002, OQ-008.)
- 2026-08-13 (WU-0004, course phases) — the phases migration was planned staging-first and failed on
  staging with `42P01: relation "course_groups" does not exist`. **Staging is missing the ENTIRE groups
  feature** (`course_groups`, `course_group_members`, `moderator_cohort_assignments`) — it only has core
  tables. The obvious assumption "staging has what the code queries" was wrong; forced the whole feature
  to prod. (OQ-008 sharpened, log.md 2026-08-13.)

## Trigger (when this fires)
About to write or apply ANY migration to a Supabase DB whose migrations are hand-applied — RLS/policy,
trigger, OR a plain `ALTER`/`CREATE` that references existing tables; any "it worked on staging, apply the
same to prod" step; a `DROP POLICY IF EXISTS` by name; any FK to an existing relation.

## Failure mode
Either (a) apply a name-targeted policy fix from the repo/one-env, get "Success", leave the live target
unchanged (invisible no-op on a security control); or (b) apply a migration that references a
table/feature the target env lacks and hit `42P01` — after already building a plan around it.

## Mitigation / Action items
Per target env, FIRST run read-only checks: `select table_name from information_schema.tables where
table_schema='public' and table_name in (…)` to confirm the relations EXIST; `pg_get_functiondef` for a
trigger; `select … from pg_policies where schemaname='public' and tablename in (…)` for exact policy
names + `relforcerowsecurity`. Only then author the apply block against the REAL shape. Re-verify after.
