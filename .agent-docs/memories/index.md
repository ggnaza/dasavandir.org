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

### Auth / Supabase (production-critical)
- `auth-trigger-must-swallow-errors.md` — **Open when:** editing `handle_new_user()`, `profiles`
  columns, or debugging "Database error saving new user" / broken Google SSO. **Carry-away:** the
  trigger must wrap its body in `EXCEPTION WHEN OTHERS` or it takes out BOTH email signup and SSO;
  never read `role` from signup metadata.
- `current-user-role-read-needs-admin-client.md` — **Open when:** reading the logged-in user's own
  role server-side, or roles "appear as learner" in the nav. **Carry-away:** RLS on `profiles` means
  use `createAdminClient()` (service role), never the user-auth client.

### Database / operations
- `migrations-applied-by-hand.md` — **Open when:** anything needs doing in Supabase, or writing a
  migration. **Carry-away:** no auto-runner — migrations are idempotent and pasted by the operator;
  hand over ONE exact paste-ready block generated from the committed file, never a lookalike summary.

### CI / agents
- `asana-build-agent-is-disabled.md` — **Open when:** reading `build-agent.yml`, or considering the
  Asana→code automation. **Carry-away:** the scheduled Build Agent is intentionally OFF
  (`disabled_manually`, 2026-08-12); the file still *says* scheduled — that's a GitHub toggle, not code.
  Its runs were failing before disable.

## Maintenance

UPDATE-IN-PLACE; adding/retiring a memory updates this index in the same change. Carry-away claims
must be traceable to the source memory.
