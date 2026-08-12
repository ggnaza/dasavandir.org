---
provenance: llm-reviewed
created: 2026-08-12
last-modified: 2026-08-12
related: [architecture-overview]
tags: [security, audit, open-items, risk]
sources: [AUDIT_REPORT.md]
---

# Security audit (2026-07-04) — open items and status

Distilled from `AUDIT_REPORT.md` (full findings + evidence live there — this is the routing summary).
Overall verdict: **good, security-conscious codebase with one urgent item.** Open questions tracking
the live actions are in `../now/open-questions.md` (OQ-001..OQ-003).

## Top issues (ranked)
| # | Sev | Issue | Tracking |
|---|---|---|---|
| 1 | 🔴 CRITICAL | A live Supabase **service-role master key** was committed to git history — bypasses all RLS. Must be **rotated** and scrubbed from history; confirm prod uses a never-committed key. | OQ-001 |
| 2 | 🟠 HIGH | Known-vulnerable third-party libs; **`xlsx` has no fix** — replace or isolate. | OQ-002 |
| 3 | 🟠 HIGH | Anti-abuse rate limiting silently weakens if **Upstash Redis** (`UPSTASH_REDIS_*`) isn't set in prod; should fail loudly. | OQ-003 |
| 4 | 🟡 MED | Unsanitized HTML rendered in the AI course-builder preview. | — |
| 5 | 🟡 MED | CSP allows `unsafe-inline` and `unsafe-eval`. | — |
| 6 | 🟡 MED | File uploads not validated for type/size server-side. | — |
| 7 | 🟡 MED | Migrations applied by hand → schema-drift risk (`../memories/migrations-applied-by-hand.md`). | — |
| 8 | 🟡 MED | Verbose internal error messages returned to clients. | — |
| 9 | 🟢 LOW | Personal data (emails) written to server logs. | — |
| 10 | 🟢 LOW | Thin automated-test coverage (e2e only, no unit tests). | — |

## Separate credential note (found during Fieldbook install, 2026-08-12)
A **GitHub personal-access token sits in plaintext** in `.claude/settings.local.json`. That file is
git-ignored (NOT on GitHub), but it is a live credential in a local file — consider rotating/removing.
Value is not reproduced here (never store secrets in git-tracked docs).

**Last-verified:** 2026-08-12 (item status not re-checked against prod since the 2026-07-04 audit —
treat severities as as-of that date until confirmed).
