---
provenance: llm-reviewed
status: accepted
template-version: 1.0.0
created: 2026-07-06
last-modified: 2026-07-06
work-unit: WU-0001
supersedes: []
superseded-by: null
related: [../reference/architecture-overview.md]
tags: [strategy, multi-tenant, roadmap]
---

# ADR-0004 — Build a new multi-tenant LMS as a clean break, not a retrofit (decided 2026-05-08)

## Context
The current TFA LMS is single-tenant. Gor wants a multi-tenant platform he owns; TFA wants to own the
current LMS outright.

## Alternatives Considered
- **Retrofit multi-tenancy into the current LMS with TFA as tenant 0** — rejected. It entangles TFA's
  data and Gor's platform business, complicates the donation to TFA, and drags legacy single-tenant
  assumptions into the new design.
- **Fork the current repo and evolve it** — rejected: same legacy-assumption drag as the retrofit.

## Decision
Build a brand-new multi-tenant LMS on a separate GitHub repo + Supabase + Vercel account, multi-tenant
from day one. The current LMS is donated to Teach For Armenia (they own it fully); TFA will NOT be a
tenant on the new platform (clean break). Replicate current features + add tenant infrastructure.

## Consequences
- Clean ownership boundary and a greenfield multi-tenant design.
- Cost: feature parity must be re-implemented; not started — revisit when current LMS work is complete.

## Related
reference/architecture-overview · project roadmap (now/work-plan backlog)
