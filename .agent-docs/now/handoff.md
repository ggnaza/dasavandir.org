---
provenance: llm-reviewed
created: 2026-07-06
last-modified: 2026-07-06
tags: [current, handoff, session-state]
related: [status, work-plan, open-questions]
generator: /handoff
---

# Session handoff — READ FIRST (2026-07-06) · 🎯 WU-0001: Fieldbook install + knowledge backfill (done)

## Project in one paragraph
Next.js 14 + Supabase LMS with role-based course access (admin / course_creator / course_manager /
learner), AI chat, and video lessons. This session set up the Fieldbook context system and backfilled
past-session knowledge into `.agent-docs/`. Work happened on branch `chore/fieldbook-install` — **not
pushed**; the default PR target is `staging`, and `main` is the promote step.

## Current state summary
- **WU-0001** Fieldbook install + backfill — DONE, committed (`aafd25e`, `260dc10`), lint-clean, unpushed.
- **WU-0002** Role-system overhaul — backlog, not started.
- **WU-0003** Google Drive video-duration auto-fetch — blocked on OQ-001.

## ⚠️ Anti-assumptions / traps (load-bearing)
- `.claude/` is **gitignored** in this repo — the skills/hooks/safety-gate/`settings.json` are installed
  locally but NOT committed or shared. Decide before relying on them team-wide.
- CLAUDE.md's auth / migrations / role-linking invariants are the source of truth — Fieldbook routes to
  them, never restates them. Don't edit outside the `<!-- kit:start/end -->` block.
- Migrations are applied BY HAND in the Supabase SQL editor — prod schema can lag the code (LP-001).
- Never `router.refresh()` during lesson-video playback (regenerates the signed URL → restarts video).

## Immediate next steps
0. Run `/orient` (this file + status + work-plan + open-questions).
1. Pick a backlog WU (WU-0002 role overhaul) or a new request.
2. If pushing Fieldbook to the team: `git push` the branch + open a PR `--base staging`, AND decide
   whether to force-add `.claude/` (it's gitignored). Do NOT push without an explicit go.

## Detour-chain (the side-quest stack)
MAIN: adopt Fieldbook → backfill past-session lessons → (fix) a space-in-path bug in the index-lint hook
that blocked commits. All resolved; no open detours.

## Recent decisions made
| When | Decision | Ref |
|---|---|---|
| 2026-07-06 | Auth trigger swallows errors, never reads role from metadata | ADR-0001 |
| 2026-07-06 | Read own role with the service-role admin client | ADR-0002 |
| 2026-07-06 | Course visibility is app-enforced, not RLS | ADR-0003 |
| 2026-05-08 | Multi-tenant successor is a clean-break separate build | ADR-0004 |

## Reading order
1. `now/status.md` · 2. `now/work-plan.md` · 3. `now/open-questions.md` · 4. `decisions/index.md`
· 5. `reference/architecture-overview.md`

## Recent commits
```
260dc10 Fieldbook: backfill past-session knowledge into .agent-docs
aafd25e Fieldbook: install Standard project-memory system (.agent-docs + hooks)
a674e36 Groups: assign a moderator per group (fixes reviewer routing in bulk)
```

---
*How to refresh this file: `/handoff`.*
