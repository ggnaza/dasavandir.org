---
provenance: kit-template
created: 2026-07-03
last-modified: 2026-07-03
tags: [log, journal]
---

# Operational log — dasavandir.org

<!-- THE one canonical operational journal. It lives HERE, at the `.agent-docs/` root (not under
     `now/`, not per-directory). There is exactly one log; append to it, never fork it.

     Append-only. NEWEST ENTRY AT THE TOP (directly under this note). One entry per session or
     operation. Keep the heading grep-parseable:

         ## YYYY-MM-DD | <op / session label> — <one-line summary>
         <a short paragraph: what happened, the commits, what's next.>

     A rejected lesson proposal logs its one-line reason here (see now/lessons/proposals.md). -->

## 2026-08-12 | WU-0001 backfill — seed the store with real project history

ingest + decision + memory. Backfilled the freshly-restored store from durable sources (`CLAUDE.md`,
`AUDIT_REPORT.md`, git history): ADR-0001 (three-table role→course access, accepted); memories
(auth-trigger-must-swallow-errors, current-user-role-read-needs-admin-client, migrations-applied-by-hand);
reference (architecture-overview, security-audit-2026-07-open-items); OQ-001..004 (leaked service-role
key, xlsx, Upstash, plaintext PAT). Updated now/{status,work-plan,handoff,open-questions}. Doc-lint clean.

## 2026-08-12 | WU-0001 install — restore the Fieldbook context store

work. The `.agent-docs/` store was missing; restored Standard-profile v0.8.2 (31 files), committed on
`chore/fieldbook-context-store` → PR #267 (base `staging`). `.claude/` engine is git-ignored (local
only). Additively added kit-doctor/kit-upgrade skills + dispatch-gate hook; brought lint-docs.py +
lint-agent-docs-indexes.sh to v0.8.2 and fixed a space-in-path bug in the index-lint. Backups under
`.kit-backups/20260812T221816Z/`.

## 2026-08-12 | handoff — Fieldbook store shipped to main+staging; Asana Build Agent disabled

work + decision + memory. Merged PR #267 (chore→staging) and #268 (staging→main) — `.agent-docs/` now
tracked on both (staging==main beforehand, so only the store was promoted). Disabled the Asana Build
Agent workflow (`gh workflow disable "Build Agent"` → `disabled_manually`); its recent scheduled runs
were failing. Filed `memories/asana-build-agent-is-disabled.md`, OQ-005 (Build Agent failures),
OQ-006 (no AI review agent). No app code changed. Doc-lint clean.

## 2026-08-12 | lesson — promoted LP-001, LP-002 to the ledger

lesson. Operator accepted both handoff proposals: LP-001 (git-diff no-diff is a false all-clear on an
ignored path) and LP-002 (committing untracked files hides them on branch switch). Moved to
`lessons/`, indexed, cleared from `now/lessons/proposals.md`. Both seedling (not MOC-promoted).

<!-- newest entries appended above this line -->
