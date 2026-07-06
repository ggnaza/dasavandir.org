---
provenance: llm-reviewed
created: 2026-07-03
last-modified: 2026-07-06
tags: [current, work-plan, decisions]
related: [status, open-questions]
---

# Work plan — Gor LMS

## The plan (phases / milestones)
- **Fieldbook setup + knowledge backfill** — done (this session, 2026-07-06).
- **Ongoing LMS maintenance** — bug-fixes and features on the current single-tenant LMS; the active
  mode. No milestone; work arrives per request.
- **Role-system overhaul** — not started (backlog, WU-0002).
- **Video-duration auto-fetch** — blocked (WU-0003).
- **Multi-tenant successor** — not started; clean-break separate build (ADR-0004).

## Locked decisions (this cycle)
- Auth trigger swallows errors + never reads role from metadata — ADR-0001.
- Read own role with the service-role admin client — ADR-0002.
- Course visibility is app-enforced on default-deny RLS — ADR-0003.
- Multi-tenant successor is a clean-break separate build — ADR-0004.

## Immediate next
> **🎯 CURRENT — WU-0001 done.** Fieldbook is installed and the past-session knowledge is backfilled
> (ADRs, memories, lessons, reference — lint-clean). Next session: run `/orient`, then pick a backlog
> WU or a new request. Do NOT re-litigate the locked decisions above without a superseding ADR.

## Work-unit spine

| WU | Objective | Depends | Status |
|---|---|---|---|
| WU-0001 | Install Fieldbook (Standard) + backfill past-session knowledge | — | done (WIRED: docs on disk, lint-clean) |
| WU-0002 | Role-system overhaul — replace single `admin` with a `super_admin` / `course_creator` hierarchy (roles, `course_permissions`, route checks, UI split) | — | backlog |
| WU-0003 | Resume Google Drive video-duration auto-fetch | OQ-001 | blocked |
