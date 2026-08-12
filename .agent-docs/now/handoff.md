---
provenance: llm-reviewed
created: 2026-08-12
last-modified: 2026-08-12
tags: [current, handoff, session-state]
related: [status, work-plan, open-questions]
generator: /handoff
---

# Session handoff — READ FIRST (2026-08-12) · 🎯 WU-0001 done (Fieldbook store shipped); Asana Build Agent disabled

## Project in one paragraph
Bilingual (Armenian-default) learning-management system on Next.js + Supabase, deployed on Vercel
(`ggnaza/dasavandir.org`; ship flow feature→`staging`→`main`). This session was **infrastructure, not
app work**: the Fieldbook context store was installed, backfilled, and shipped to production, and the
Asana Build Agent CI workflow was switched off. Zero application code changed.

## Current state summary
| Item | State |
|---|---|
| Fieldbook `.agent-docs/` store | ✅ Live on `main` + `staging` (PR #267 chore→staging, #268 staging→main, both merged) |
| Store contents | Restored (Standard v0.8.2) + backfilled (ADR-0001, 4 memories, 2 reference docs, OQ-001..006) |
| Asana Build Agent (`build-agent.yml`) | 🔴 `disabled_manually` — off (was failing hourly before disable) |
| QA / Scheduled QA (Playwright) | 🟢 Active — left on (these are test runners, not AI) |
| `.claude/` engine | Local-only (git-ignored, protects a plaintext token) |
| Checked-out branch | `feat/timetable-week-view` (1 commit ahead of main — pre-existing, untouched) |

## Important context
- Auth is production-fragile — read before touching: `memories/auth-trigger-must-swallow-errors.md`,
  `memories/current-user-role-read-needs-admin-client.md`.
- Migrations are hand-applied in Supabase: `memories/migrations-applied-by-hand.md`.
- Role→course access model: `ADR-0001`. Architecture map: `reference/architecture-overview.md`.
- The Asana Build Agent is intentionally OFF: `memories/asana-build-agent-is-disabled.md`.

## ⚠️ Anti-assumptions / traps (load-bearing)
- **`.agent-docs/` is UNTRACKED on `feat/timetable-week-view`.** It's tracked on `main`/`staging`, not
  this branch. Editing it here (e.g. this handoff) produces untracked local changes that do NOT reach
  the shared store until `main` flows back or you commit them deliberately. Don't assume a `git commit`
  on this branch captures them into the canonical store.
- **`.claude/` is git-ignored ON PURPOSE** — never `git add -f` it; `settings.local.json` holds a
  plaintext GitHub PAT (OQ-004).
- **`build-agent.yml` still SAYS it's scheduled** — "disabled" is a GitHub toggle, not in the file.
  Reading the YAML alone would wrongly suggest it's live (`memories/asana-build-agent-is-disabled.md`).
- **`main` is ahead of `staging` by merge commits** after the #268 promotion (content-identical:
  `origin/main..origin/staging` = 0). Normal for their merge-commit workflow; not a divergence to "fix".
- **"QA" here = Playwright test runner, not an AI reviewer.** No AI reviews PRs or agent output (OQ-006).

## Detour-chain (the side-quest stack)
MAIN: "did we install Fieldbook / dynamic workflows?" → found `.claude/` engine present but
`.agent-docs/` store missing → restored the store → found `.claude/` an older cut → additively upgraded
to v0.8.2 (kit-doctor/kit-upgrade/dispatch-gate; fixed a space-in-path lint bug) → found `.claude/`
git-ignored → committed only `.agent-docs/` (#267) → backfilled the store with real history → merged to
staging + main (#267/#268) → answered "do we have QA agents?" (mapped the 3 CI workflows) → operator
asked to disable the Asana Build Agent → disabled it (this handoff). All resolved; nothing left open in
the chain except the OPTIONAL follow-ups below.

## Immediate next steps
No blocking work. Optional, operator's call:
1. **Wire an AI PR-review agent** (OQ-006) — the highest-value gap; nothing AI-reviews code today.
2. **Codify the Build Agent OFF state** — open a PR commenting out the `schedule:` in `build-agent.yml`
   so the disable is visible in code (currently only a GitHub toggle).
3. **Investigate Build Agent run failures** (OQ-005) — only if it will ever be re-enabled.
4. Operator-owned security items: OQ-001 (rotate leaked service-role key) → OQ-004 (plaintext PAT).
- Do NOT push to `main` without an explicit go. PRs target `staging` by default.

Useful commands (verbatim):
```
gh workflow enable "Build Agent"          # re-enable the Asana agent if ever wanted
python3 .claude/hooks/lint-docs.py --root .agent-docs   # doc-schema lint (v0.8.2)
```

## Recent decisions made
| When | Decision | Ref |
|---|---|---|
| 2026-08-12 | Ship the Fieldbook store to `staging` AND `main` (store only, not all of staging) | PR #267, #268 |
| 2026-08-12 | Disable the Asana Build Agent | `memories/asana-build-agent-is-disabled.md` |
| 2026-08-12 | Track only `.agent-docs/`; keep `.claude/` local (secret protection) | status.md |
| 2026-08-12 | Three role-specific link tables, never one shared table | ADR-0001 |

## Breadcrumbs / artifacts
- Kit clone used for the install: `…/scratchpad/ctx-fieldbook` (v0.8.2 checkout) — throwaway, safe to
  delete. Backfill backup: `…/scratchpad/agent-docs-backfill`.
- Overwritten-file backups from the `.claude/` upgrade: `.kit-backups/20260812T221816Z/` (repo root).

## Reading order
1. `now/status.md` · 2. `now/work-plan.md` · 3. `now/open-questions.md` ·
4. `reference/architecture-overview.md` · 5. `memories/` (auth, migrations, build-agent) ·
6. `decisions/0001-...md` · 7. `CLAUDE.md` (always-on invariants). No sitrep exists this session.

## Recent commits
```
2ed3ae5 Merge pull request #267 from ggnaza/chore/fieldbook-context-store   [on staging/main]
6cd3f3a docs(agent-docs): backfill the context store with real project history
8b44a4a chore: add Fieldbook .agent-docs context store (project memory)
614abc3 feat: weekly tabs and time ripple in the creator timetable          [feat branch tip]
```

---
*How to refresh this file: `/handoff`.*
