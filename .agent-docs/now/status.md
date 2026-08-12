---
provenance: llm-reviewed
created: 2026-07-03
last-modified: 2026-08-12
tags: [current, status]
related: [work-plan, open-questions, handoff]
---

# Status — dasavandir.org · Fieldbook context store installed + backfilled · 2026-08-12

## TL;DR
WU-0001 (install + backfill the Fieldbook context store) is the active unit. The `.agent-docs/` store
was missing; it's now restored (Standard profile, v0.8.2) and committed on branch
`chore/fieldbook-context-store` via PR #267 → `staging`. This session also backfilled the store with
the project's real history (ADR-0001, three memories, two reference docs, OQ-001..004). Next: merge
#267 after review; the operator still owns the audit's open security items.

## Branch / working tree
- Working on `feat/timetable-week-view` (the timetable feature branch; base `main`).
- The Fieldbook store lives on `chore/fieldbook-context-store` (PR #267 → `staging`). On
  `feat/timetable-week-view` the `.agent-docs/` files are present locally but untracked until #267
  merges and flows back.

## Build / test state
- Gates: `npm run build` · `npm run test:e2e` (no separate lint/format scripts). Not re-run this
  session — Fieldbook work touched only `.agent-docs/` + local `.claude/`, not app code.
- Doc-lint (`lint-docs.py` v0.8.2): clean on the store.

## Context-system state
- `.agent-docs/` restored + backfilled: ADR-0001, memories (auth trigger, admin-client role read,
  hand-applied migrations), reference (architecture-overview, security-audit-open-items), OQ-001..004.
- `.claude/` engine is git-ignored (local-only, protects a plaintext token in `settings.local.json`).
  Added `kit-doctor`/`kit-upgrade` skills + `dispatch-gate` hook; fixed a space-in-path bug in the
  index-lint.

## What this means for next steps
Review + merge PR #267 to persist the store to `staging`. Going forward: `/orient` to start a session,
`/handoff` to end one. The audit items (OQ-001..003) are operator actions, not code changes.
