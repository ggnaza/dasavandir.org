---
provenance: llm-reviewed
template-version: 1.0.0
created: 2026-08-12
last-modified: 2026-08-12
related: [auth-trigger-must-swallow-errors]
tags: [supabase, migrations, operator, schema-drift]
---

# Migrations are applied BY HAND in the Supabase SQL editor — there is no auto-runner, so every migration must be idempotent and handed over as an exact paste-ready block

**Observed:** `supabase/migrations/` holds 40+ files but nothing runs them automatically. The operator
pastes SQL into the Supabase SQL editor. Two past production outages traced to manual migration
mistakes. Claude cannot execute DDL here (no `psql`, no connection string — only the REST key), so
applying a migration is always the operator's action.

**Root cause:** no CI-applied migration step. Schema drift and copy-paste errors are the failure mode
(the audit flags this as Issue #7, MEDIUM).

**Workaround / fix:** every new migration is idempotent (`CREATE TABLE IF NOT EXISTS`,
`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS` before `ADD CONSTRAINT`). When
something needs doing in Supabase, output ONE complete paste-ready ```sql block generated from the
committed file (`git show origin/main:supabase/migrations/x.sql`), never retyped from memory. Verify
afterwards by querying via the service-role key.

**Avoid:** never print a "here's what it does" summary inside a ```sql fence (a line like
`UPDATE assignments ...   (backfill from rubrics)` gets pasted and fails with `42601: syntax error near
".."` — this has happened). No `-- expect N rows` trailers, no two statements on one line (the editor
shows only the last result). Describe statements in prose or a text-tagged fence — never as runnable
SQL unless it IS the exact block to run.

**See also:** `CLAUDE.md` §Migrations + §Handing SQL to the operator; `AUDIT_REPORT.md` Issue #7.
