---
provenance: llm-draft
created: 2026-07-03
last-modified: 2026-08-12
tags: [current, lessons, proposals, staging]
related: [MOC, ../../lessons/index]
---

# Lessons proposals — staging for human-gated promotion

The **staging area** for candidate lessons before they enter the ledger. The distillation pass appends
0–3 qualifying candidates here (`provenance: llm-draft`, `maturity: seedling`); `/handoff` walks each
one with the operator (**accept / defer / reject**). This file is the dedup baseline for the
distillation pass. **Nothing here is a lesson yet** — promotion to `../../lessons/<id>.md` is
human-gated.

> **Why a staging gate.** Same-model self-reflection collapses to confirmation bias without a human
> gate. "0 high-quality proposals" beats "3 weak ones" — a candidate that doesn't meet all four bars
> (concrete trigger · stable claim · evidence link · not-duplicate) is dropped, not padded.

## Staged candidates

_(none — LP-001 and LP-002 accepted + promoted to `../../lessons/` on 2026-08-12.)_

## Lifecycle

- **accept** → moved to `../../lessons/<id>.md`, gains a `lessons/index.md` entry (+ a `MOC.md` row if
  Tier-1/evergreen); removed from here.
- **defer** → stays here for the next `/handoff`.
- **reject** → removed, with a one-line reason logged to `../../log.md`.

## Maintenance

UPDATE-IN-PLACE; the distillation pass appends, `/handoff` drains. `last-modified` staleness is
lint-checked.
