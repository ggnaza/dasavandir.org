---
provenance: llm-reviewed
created: 2026-07-03
last-modified: 2026-08-12
tags: [current, status]
related: [work-plan, open-questions, handoff]
---

# Status — dasavandir.org · Fieldbook store live on main + staging; Asana Build Agent disabled · 2026-08-12

## TL;DR
WU-0001 (install + backfill the Fieldbook context store) is **complete and shipped** — merged to
`staging` (#267) and `main` (#268); `.agent-docs/` is now tracked on both. Also this session: the Asana
**Build Agent** GitHub workflow was **disabled** at the operator's request. No app code changed all
session. Next: nothing blocking — optionally wire an AI PR-review agent (OQ-006), or investigate the
Build Agent failures only if it will be re-enabled (OQ-005).

## Branch / working tree
- Checked out on `feat/timetable-week-view` (base `main`; 1 commit ahead — the pre-existing timetable
  work, untouched this session).
- ⚠️ On this branch `.agent-docs/` shows as **untracked** — the store is tracked on `main`/`staging`,
  not on this feature branch yet. This is expected; it flows in when `main` merges back.
- Also untracked (pre-existing, NOT ours): `AUDIT_REPORT.md`, `CLAUDE.md.fieldbook-backup-*`,
  `test-results/`.

## Build / test state
- Gates: `npm run build` · `npm run test:e2e` (no separate lint/format scripts). Not run this session —
  only `.agent-docs/` + local `.claude/` + a CI toggle changed; zero app code.
- Doc-schema lint (`lint-docs.py` v0.8.2): clean.

## Context-system state
- `.agent-docs/` store restored + backfilled + shipped (PR #267/#268). New this session:
  `memories/asana-build-agent-is-disabled.md`; OQ-005 (Build Agent failing), OQ-006 (no AI review agent).
- CI: `Build Agent` workflow = `disabled_manually`; `QA` + `Scheduled QA` (Playwright) still active.

## What this means for next steps
No blockers. The memory system is live and shared. Optional follow-ups are OQ-005/OQ-006 (operator's
call). Going forward: `/orient` to start, `/handoff` to end. If you edit `.agent-docs/` on this feature
branch, note it's untracked here until `main` flows back.
