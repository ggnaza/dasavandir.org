---
provenance: kit-template
created: 2026-07-03
last-modified: 2026-07-06
tags: [meta, index, routing, decisions]
related: [CONVENTIONS]
---

# decisions/ — routing catalog

Decision records (`ADR-NNNN`): why we chose what. **`ADR-NNNN` is the canonical decision ID**, stable
forever; **supersession, not deletion**. Every ADR carries a mandatory `## Alternatives Considered`
field (the dead-ends ARE the value — a rejected option + why is the record's reason to exist). Entries
here carry the claim-as-carry-away **plus status**. Route by status first (don't act on a
`superseded`/`rejected` ADR), then by topic. Schema authority: `../CONVENTIONS.md`.

> **Why a decision ledger.** A non-trivial choice with its rejected alternatives written down *before*
> acting is the antidote to re-litigating settled questions and to reverse-engineering rationale after
> the fact. An ADR whose `## Alternatives Considered` was filled in afterwards is lint-incomplete.

## Entry purpose + naming

- **Purpose:** one settled decision, with the alternatives weighed and why they lost.
- **Filename:** `decisions/NNNN-<kebab-slug>.md` (zero-padded, monotonic; IDs never reused).
- **Write-discipline:** APPEND-ONLY for new ADRs; an existing ADR changes `status:` in place, never
  moves. Supersession via frontmatter (`superseded-by:` + `status: superseded`), not deletion.

## Entry SCHEMA (front-matter + body)

- Front-matter: `provenance` × `status` (`proposed` → `accepted` / `rejected` / `superseded`) ×
  `tags` × `related`. An `accepted` ADR may **not** be `provenance: llm-draft`/`llm-autonomous` — a
  human signs off before accept.
- Body: Context · Decision · **Alternatives Considered** (non-empty, authored before the work) ·
  Consequences · (optional) the work-unit (`WU-NNNN`) or open question (`OQ-NNN`) it resolves.

## Decisions (route by status, then topic)

- ⭐ `0001-handle-new-user-trigger-must-swallow-errors.md` — **Open when:** touching auth signup / the `profiles` trigger. **Carry-away:** the trigger must `EXCEPTION WHEN OTHERS` and never read role from metadata; app defensively upserts profiles. *(accepted.)*
- ⭐ `0002-read-own-role-with-admin-client.md` — **Open when:** reading the logged-in user's role/profile. **Carry-away:** use `createAdminClient()`, not the user-auth client, or RLS drift downgrades everyone to learner. *(accepted.)*
- `0003-app-enforced-course-visibility.md` — **Open when:** adding a learner-facing course surface. **Carry-away:** visibility is app-enforced on default-deny RLS; every surface must apply the enrollment filter itself. *(accepted.)*
- `0004-separate-multi-tenant-platform-clean-break.md` — **Open when:** planning the multi-tenant successor. **Carry-away:** new platform is a clean-break separate build; TFA owns the current LMS, not a tenant. *(accepted, 2026-05-08.)*

## Maintenance

APPEND-ONLY for new ADRs; existing ADRs change `status:` in place, never move (supersession via
`superseded-by:`). Adding/retiring an ADR updates this index in the SAME change. `status: accepted`
⇒ may not be `llm-draft`/`llm-autonomous`.
