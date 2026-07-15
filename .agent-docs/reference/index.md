---
provenance: kit-template
created: 2026-07-03
last-modified: 2026-07-06
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
- **Filename:** `reference/<kebab-topic>.md` (e.g. `architecture-overview.md`, `validated-versions`).
- **Write-discipline:** UPDATE-IN-PLACE (rare). A standard-of-record carries `provenance: human`.

## Entry SCHEMA (body)

What-it-is (the fact, stated plainly) · Scope / where it applies · Evidence or source (so it can be
re-verified) · Last-verified (facts drift — date the check) · See also.

## Reference docs

- `architecture-overview.md` — **Open when:** you need the big-picture stack/roles before changing a subsystem. **Carry-away:** Next.js 14 + Supabase + Vercel; four roles, each linked to courses via its OWN table. (Verified 2026-07-06.)
- `course-visibility-model.md` — **Open when:** adding/auditing a learner-facing course surface. **Carry-away:** app-enforced visibility on default-deny RLS; per-surface enrollment-filter status. (Verified 2026-07-06.)
- `moderator-access-model.md` — **Open when:** a moderator's learner/submission visibility. **Carry-away:** course_manager_access = gate; the learner subset is group-membership-based. (Verified 2026-07-06.)
- `security-posture.md` — **Open when:** tempted to re-audit, or before a security change. **Carry-away:** audit complete/fixed; only `audit_logs` table + monitored-inbox remain. (Verified 2026-07-06.)
- `time-on-task-tracking.md` — **Open when:** touching "time spent" analytics. **Carry-away:** active-only tracking + a 1h read-clamp; never clamp `lessons.duration_seconds`. (Verified 2026-07-06.)
- `analytics-information-architecture.md` — **Open when:** navigating/adding an analytics tab. **Carry-away:** Analytics is a sub-tab group (Gradebook default / Quizzes / Reflections); AI-Coach has a Usage sub-tab. (Verified 2026-07-06.)

## Maintenance

UPDATE-IN-PLACE; adding/retiring a reference doc updates this index in the same change. Carry-away
claims must be traceable to the source doc — never approximate from memory.
