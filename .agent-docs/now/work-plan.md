---
provenance: llm-reviewed
created: 2026-07-03
last-modified: 2026-08-12
tags: [current, work-plan, decisions]
related: [status, open-questions]
---

# Work plan — dasavandir.org

## The plan (phases / milestones)
- Fieldbook context store: **install + backfill** — done this session (PR #267 pending merge).
- Creator timetable (weekly tabs + time ripple) — shipped (commit 614abc3); feature branch
  `feat/timetable-week-view` in flight.
- Security audit follow-through (2026-07) — open, operator-owned (OQ-001..003).

## Locked decisions (this cycle)
- Role→course access uses three role-specific link tables, never one shared table — `ADR-0001`.
- Only the `.agent-docs/` memory is git-tracked; the `.claude/` engine stays local (protects a token).
- Fieldbook changes ship on their own branch/PR, separate from feature work.

## Immediate next
> **🎯 CURRENT — WU-0001: install + backfill the Fieldbook context store.** Remaining step: review +
> merge PR #267 → `staging` to persist the store. Do NOT force-add `.claude/` (contains a secret).
> Going forward, run `/orient` at session start and `/handoff` at session end.

## Work-unit spine

| WU | Objective | Depends | Status |
|---|---|---|---|
| WU-0001 | Install + backfill the Fieldbook context/memory store | — | active (PR #267 open) |
| WU-0002 | Creator timetable: weekly tabs + time ripple | — | done (614abc3) |
