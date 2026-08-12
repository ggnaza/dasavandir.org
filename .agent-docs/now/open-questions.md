---
provenance: llm-reviewed
created: 2026-07-03
last-modified: 2026-08-12
tags: [current, open-questions]
related: [status, work-plan]
---

# Open questions — dasavandir.org

> `OQ-NNN` is the single source. Reference by number. Resolve → move the item to "Recently resolved"
> with a closure reference (a commit / `ADR-NNNN` / log entry). Surface gaps loudly — an honest
> open-question beats a polished plan with a hidden assumption.

## Open

- **OQ-001** (🔴 security; surfaced 2026-07-04 by the audit) — A live Supabase **service-role master
  key** was committed to git history (bypasses all RLS). **Resolve:** rotate the key, scrub it from
  history, and confirm prod uses a never-committed key. Owner: operator. Relates:
  `../reference/security-audit-2026-07-open-items.md` (Issue #1).
- **OQ-002** (🟠 security; surfaced 2026-07-04) — `xlsx` dependency has a known vuln with **no
  upstream fix**. **Resolve:** replace or isolate the library. Relates: audit Issue #2.
- **OQ-003** (🟠 reliability; surfaced 2026-07-04) — Rate limiting silently weakens if
  **`UPSTASH_REDIS_*`** isn't set in production. **Resolve:** confirm it's configured in prod and make
  the limiter fail loudly without a distributed backend. Relates: audit Issue #3.
- **OQ-004** (🟡 security; surfaced 2026-08-12 during Fieldbook install) — A **GitHub PAT sits in
  plaintext** in `.claude/settings.local.json` (git-ignored, so not on GitHub, but a live credential in
  a file). **Resolve:** operator decides whether to rotate/remove. Value not stored anywhere in
  `.agent-docs/`.

## Recently resolved

<!-- EXAMPLE (move resolved items here with their closure ref):
- **OQ-000** — <the question> → RESOLVED <YYYY-MM-DD> by <commit / ADR-NNNN / log entry>.
-->
