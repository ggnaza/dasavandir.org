---
provenance: llm-reviewed
created: 2026-07-03
last-modified: 2026-08-12
tags: [current, handoff, session-state]
related: [status, work-plan, open-questions]
generator: /handoff
---

# Session handoff — READ FIRST (2026-08-12) · 🎯 WU-0001 Fieldbook context store: installed + backfilled, PR #267 pending merge

## Project in one paragraph
Bilingual (Armenian-default) learning-management system on Next.js + Supabase, deployed on Vercel
(`ggnaza/dasavandir.org`, ship flow feature→`staging`→`main`). This session installed the Fieldbook
context store (it was missing) and backfilled it with the project's real history. The single most
important thing before touching auth or migrations: read the memories — the auth trigger and role reads
have broken production before.

## Current state summary
| Item | State |
|---|---|
| Fieldbook `.agent-docs/` store | Restored (Standard v0.8.2) + backfilled; committed on `chore/fieldbook-context-store`, **PR #267 → `staging`** (pending merge) |
| `.claude/` engine | Local-only (git-ignored); added kit-doctor/kit-upgrade + dispatch-gate; index-lint space bug fixed |
| Timetable feature | On `feat/timetable-week-view` (checked out now); weekly tabs shipped (614abc3) |
| Audit open items | OQ-001..004 — operator-owned, not code changes |

## ⚠️ Anti-assumptions / traps (load-bearing)
- **`.claude/` is git-ignored on purpose** — do NOT `git add -f` it; `settings.local.json` holds a
  plaintext GitHub token (OQ-004).
- On `feat/timetable-week-view` the `.agent-docs/` files show as **untracked** — they're tracked on the
  chore branch / PR #267, not here yet. That's expected.
- The `handle_new_user()` trigger and current-user role reads are production-fragile — see memories
  before editing auth.
- Migrations are applied **by hand** in Supabase; hand over exact paste-ready SQL, never a lookalike.

## Immediate next steps
1. Review + merge **PR #267** → `staging` to persist the store.
2. Continue timetable work on `feat/timetable-week-view` as needed.
3. (Operator) address audit items OQ-001 (rotate leaked service-role key) → OQ-003.
- Do NOT push to `main` without an explicit go; PRs target `staging` by default.

## Detour-chain (the side-quest stack)
MAIN: get Fieldbook working → discovered `.agent-docs/` store missing → restored it → discovered
`.claude/` older cut → additively upgraded to v0.8.2 → discovered `.claude/` is git-ignored → committed
only `.agent-docs/` (PR #267) → backfilled the store with real project history (this handoff).

## Recent decisions made
| When | Decision | Ref |
|---|---|---|
| 2026-08-12 | Three role-specific link tables, never one shared table | ADR-0001 |
| 2026-08-12 | Track only `.agent-docs/`; keep `.claude/` local | status.md / PR #267 |

## Obligations (single-party form)
- **Waiting on (owed to me):** operator to review/merge PR #267; operator to action OQ-001..003.
- **I owe:** _(none pending)_

## Reading order
1. `now/status.md` · 2. `now/work-plan.md` · 3. `now/open-questions.md` ·
4. `reference/architecture-overview.md` · 5. `memories/` (auth + migrations) · 6. `decisions/0001-...md`.

## Recent commits
```
8b44a4a chore: add Fieldbook .agent-docs context store (project memory)  [chore branch]
614abc3 feat: weekly tabs and time ripple in the creator timetable
0cd39f3 feat: group-scoped timetables (ADR-0005 Model B) with its UI (#257)
c1667ce feat: agenda sheet importer + separate the daily email from the schedule (#256)
```

---
*How to refresh this file: `/handoff`.*
