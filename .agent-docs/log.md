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

<!-- newest entries appended above this line -->
