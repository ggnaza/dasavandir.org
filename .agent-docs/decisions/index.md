---
provenance: kit-template
created: 2026-07-03
last-modified: 2026-08-13
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

- ⭐ `0001-role-to-course-access-via-three-link-tables.md` — **Open when:** "why not one shared
  enrollments table for all roles?" or adding/editing any code that attaches a user to a course.
  **Carry-away:** each role links through its own table (`course_creator_access` /
  `course_manager_access` / `enrollments`); a shared table breaks role visibility *silently*.
  *(status: accepted.)*

- `0002-break-rls-recursion-with-security-definer-is-admin.md` — **Open when:** touching any RLS policy
  that resolves a role, hitting `42P17` recursion, or wondering why the app reads everything via the
  service-role client. **Carry-away:** break RLS recursion with a `SECURITY DEFINER` `is_admin()`
  helper and rewrite only the 4 back-edge policies (semantically identical) — do NOT rewrite the whole
  policy graph on a live DB. *(status: accepted — applied to staging + prod, verified live.)*

- ⭐ `0003-course-phases-within-a-single-course.md` — **Open when:** working on TLA phases, group
  phase-scoping, the phased submissions queue, phase-aware reviewer routing, or "why not a separate
  course for Regional Orientation, or why not a bare smallint?" **Carry-away:** a course runs in ordered
  phases via a `course_phases` table + `lessons.phase_id` + `course_groups.phase_id` (`NULL`=untagged;
  a course with no phase rows behaves exactly as today); one group per learner per `(course, phase_id)`;
  a moderator's queue is phase-scoped with untagged lessons visible to all; reviewer attribution follows
  the assignment lesson's phase; timetable hidden pending rework. *(status: accepted.)*

## Maintenance

APPEND-ONLY for new ADRs; existing ADRs change `status:` in place, never move (supersession via
`superseded-by:`). Adding/retiring an ADR updates this index in the SAME change. `status: accepted`
⇒ may not be `llm-draft`/`llm-autonomous`.
