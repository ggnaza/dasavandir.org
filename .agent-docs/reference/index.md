---
provenance: kit-template
created: 2026-07-03
last-modified: 2026-07-03
tags: [meta, index, routing, reference]
related: [CONVENTIONS]
---

# reference/ — routing catalog

Stable **WHAT-IS** facts: architecture notes, inventories, syntheses, validated-version matrices, and
**standards of record** (living, agent-enforced standards). Tier-2 — loaded on demand. UPDATE-IN-PLACE
(rare — these are durable facts, not fleeting state). Schema authority: `../CONVENTIONS.md`.

> **reference/ vs research/ vs decisions/.** `reference/` holds the DISTILLED fact ("this is how the
> auth layer is shaped"). `research/` (Full profile) holds the woven investigation genealogy that
> produced a fact. `decisions/` holds WHY a fork was chosen (an ADR). A fact with no live decision and
> no open investigation belongs here.

## Entry purpose + naming

- **Purpose:** capture a stable, reusable fact so it is not re-derived from scratch each session.
- **Filename:** `reference/<kebab-topic>.md` (e.g. `architecture-overview.md`, `validated-versions.md`).
- **Write-discipline:** UPDATE-IN-PLACE (rare). A standard-of-record carries `provenance: human`.

## Entry SCHEMA (body)

What-it-is (the fact, stated plainly) · Scope / where it applies · Evidence or source (so it can be
re-verified) · Last-verified (facts drift — date the check) · See also.

## Reference docs

<!-- EXAMPLE (delete this block on the first real reference doc):
- `architecture-overview.md` — **Open when:** you need the big-picture shape before changing a
  subsystem. **Carry-away:** <the one-sentence fact this doc anchors>. (Verified <date>.)
-->

## Maintenance

UPDATE-IN-PLACE; adding/retiring a reference doc updates this index in the same change. Carry-away
claims must be traceable to the source doc — never approximate from memory.
