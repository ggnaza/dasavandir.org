---
provenance: kit-template
created: 2026-07-03
last-modified: 2026-07-03
tags: [meta, index, routing, memories]
related: [CONVENTIONS]
---

# memories/ — routing catalog

Non-obvious gotchas + findings, **titled as claims, not topics**. Tier-2 — loaded on demand when the
claim is relevant. UPDATE-IN-PLACE (rare). Schema authority: `../CONVENTIONS.md` (memory template).

> **Memory vs lesson vs ADR.** A *memory* is a standing gotcha/fact ("X behaves surprisingly because
> Y"). A *lesson* is a behavioral rule with promotion + decay (`lessons/`). An *ADR* is a settled
> decision (`decisions/`). When in doubt: did it change how we ACT (lesson) or decide a fork (ADR)?
> Otherwise it's a memory.

## Entry purpose + naming

- **Purpose:** capture a non-obvious finding so it isn't re-derived — the title IS the claim.
- **Filename:** `memories/<kebab-claim-as-title>.md`. Good:
  `build-needs-explicit-env-recipe`. Bad: `build-notes`.
- **Write-discipline:** UPDATE-IN-PLACE (rare).

## Entry SCHEMA (body)

Observed (when/where/how it surfaces) · Root cause (if known) · Workaround / fix · Avoid (specific
anti-actions) · See also (related docs, upstream issues, commit refs).

## Memories

<!-- EXAMPLE (delete this block on the first real memory):
- `example-surprising-behavior-because-cause.md` — **Open when:** <the situation where this gotcha
  bites>. **Carry-away:** <the claim in one sentence + the specific anti-action>. (Surfaced <where>.)
-->

## Maintenance

UPDATE-IN-PLACE; adding/retiring a memory updates this index in the same change. Carry-away claims
must be traceable to the source memory.
