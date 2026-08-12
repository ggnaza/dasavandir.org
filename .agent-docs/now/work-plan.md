---
provenance: llm-reviewed
created: 2026-07-03
last-modified: 2026-08-12
tags: [current, work-plan, decisions]
related: [status, open-questions]
---

# Work plan — dasavandir.org

## The plan (phases / milestones)
- Fieldbook context store: install + backfill — ✅ done + shipped to `main`+`staging` (#267, #268).
- Asana Build Agent — ✅ disabled at operator request (2026-08-12).
- Creator timetable (weekly tabs + time ripple) — shipped (commit 614abc3); feature branch
  `feat/timetable-week-view` still checked out.
- Security audit follow-through (2026-07) — open, operator-owned (OQ-001..003).
- (Optional) AI PR-review agent — proposed, not built (OQ-006).

## Locked decisions (this cycle)
- Role→course access uses three role-specific link tables, never one shared table — `ADR-0001`.
- Only the `.agent-docs/` memory is git-tracked; the `.claude/` engine stays local (protects a token).
- Fieldbook changes ship on their own branch/PR, separate from feature work.
- Fieldbook store promoted to production (`main`), scoped to only the store (staging==main beforehand).
- Asana Build Agent (`build-agent.yml`) is OFF — `memories/asana-build-agent-is-disabled.md`.

## Immediate next
> **🎯 No blocking work-unit in flight.** WU-0001 is done. Optional next actions are operator's call:
> (a) wire an AI PR-review agent (OQ-006), (b) investigate Build Agent failures IF re-enabling (OQ-005),
> (c) codify the Build Agent OFF state in `build-agent.yml` via PR. Do NOT push to `main` without an
> explicit go. `.agent-docs/` edits on this feature branch are untracked until `main` flows back.

## Work-unit spine

| WU | Objective | Depends | Status |
|---|---|---|---|
| WU-0001 | Install + backfill the Fieldbook context/memory store | — | ✅ done (#267, #268 merged) |
| WU-0002 | Creator timetable: weekly tabs + time ripple | — | done (614abc3) |
