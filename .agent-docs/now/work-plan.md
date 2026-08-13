---
provenance: llm-reviewed
created: 2026-07-03
last-modified: 2026-08-13
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
> **🎯 No blocking work-unit in flight.** WU-0004 (course phases) shipped to prod (`main` #273/#274) and
> staging (#272); migration applied to prod; TLA/Regional lessons tagged. Operator is mid-setup on prod:
> granting `course_manager_access` to new Regional moderators → assigning them to Regional groups →
> adding learners (now via the multi-select picker). **Possible follow-ups (operator's call):**
> (a) a **"move learner between groups within a phase"** control (offered, not built — currently
> remove-then-re-add); (b) **OQ-008** reconcile schema drift + applied-migrations ledger (this session
> proved staging lacks the whole groups feature); (c) **OQ-007 stage 3** RLS hardening. Do NOT push to
> `main` without an explicit go (operator authorised the prod path for phases this session).

## Work-unit spine

| WU | Objective | Depends | Status |
|---|---|---|---|
| WU-0001 | Install + backfill the Fieldbook context/memory store | — | ✅ done (#267, #268 merged) |
| WU-0002 | Creator timetable: weekly tabs + time ripple | — | done (614abc3) |
| WU-0003 | RLS recursion + auth trigger / policy hardening | — | ✅ done — recursion fix applied to staging + prod (verified live), files on `main` (PR #271). Stage-3 remainder deferred (OQ-007). ADR-0002 accepted. |
| WU-0004 | Course phases (TLA → Regional Orientation) — per-phase groups, phase-tagged lessons, phase-scoped review + notifications, hide timetable | — | ✅ done — shipped to prod (`main` #273 + #274) + staging (#272); prod migration applied; TLA lessons tagged. ADR-0003 accepted (on `origin/main`, not this local branch). |
