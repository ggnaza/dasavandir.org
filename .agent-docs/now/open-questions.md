---
provenance: llm-reviewed
created: 2026-07-03
last-modified: 2026-08-13
tags: [current, open-questions, rls, security]
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
- **OQ-005** (🟢 ops; surfaced 2026-08-12) — The Asana **Build Agent's** last several scheduled runs
  were **failing** before it was disabled. **Resolve:** only if re-enabling — investigate the failure
  cause first. Lower priority now that it's off (`memories/asana-build-agent-is-disabled.md`).
- **OQ-006** (🟢 process; surfaced 2026-08-12) — No **AI QA/review agent** exists: neither human PRs
  nor the (now-off) Build Agent's output get AI review; Playwright covers only functional regressions
  it has tests for. **Resolve:** decide whether to wire a PR-review workflow (offered, not built).
- **OQ-007** (🟡 was 🔴; recursion RESOLVED 2026-08-13, stage-3 remainder open) — The RLS layer for
  the **authenticated (browser) role recursed (42P17)** through `profiles`. ✅ The recursion itself is
  **fixed and live on staging + production** (`is_admin()` helper + 4 back-edge rewrites, ADR-0002,
  verified against pg_policies). **Still open (deferred by decision):** stage 3 — convert the remaining
  ~40 inline `profiles` reads to helpers (recursion-proof everything + one canonical RLS file), and the
  larger question of making RLS actually *load-bearing* (move app reads off the service-role client).
  Not started; no blocker.
- **OQ-008** (🟠 reliability; surfaced 2026-08-12) — **Three divergent schema sources of truth** exist
  with no ledger of what is actually applied to prod: `supabase/staging-setup.sql` (the real
  bootstrap), `supabase/schema.sql`, and the incremental `supabase/migrations/` dir. They disagree
  (e.g. 5 different `handle_new_user()` bodies; `features_v2.sql` had an invalid `CREATE POLICY IF NOT
  EXISTS`). **Resolve:** dump live `pg_policies` + function defs, pick ONE canonical representation,
  and add an applied-migrations ledger. Relates: `memories/migrations-applied-by-hand.md`.
  Concrete drift found 2026-08-13 during the RLS apply: prod's enrollments admin policy is named
  `"Admins view all enrollments"` (SELECT) vs staging's `"Admins manage all enrollments"` (ALL); prod is
  **missing** `"Managers view their course enrollments"` + `"Managers view assigned course students"`
  that staging has; staging's `handle_new_user()` lacked the email role-inheritance that prod has. Three
  environments, three shapes.
  **Sharpened 2026-08-13 (course-phases session):** staging is missing the **entire groups feature** —
  `course_groups`, `course_group_members`, `moderator_cohort_assignments` do NOT exist on staging (only
  core tables do). Any migration touching those relations fails on staging with `42P01`. This blocks
  staging-first testing for anything groups-related and forced the phases work to prod. A real fix needs
  a decision on whether staging should mirror prod's schema at all, or be treated as a thin/partial env.

- **OQ-009** (🟢 product; surfaced 2026-08-13) — The groups manager has **no "move a learner between
  groups within a phase"** control; moving someone is remove-then-re-add. Offered to the operator, not
  built. **Resolve:** add a per-member "move to group" dropdown (or drag) scoped to the current phase, or
  decide the remove/re-add flow is acceptable. Relates: ADR-0003, `app/admin/courses/[id]/groups/groups-manager.tsx`.

- **OQ-010** (🟡 product/UX; surfaced 2026-08-13) — **Timetable is only hidden, not hard-gated.** The
  learner + admin timetable pages still resolve by direct URL; only the nav links were removed (ADR-0003,
  §5). Once a learner is in two groups, `resolved_timetable()`'s `LIMIT 1` picks a group arbitrarily.
  **Resolve:** the timetable rework must resolve the learner's group *within a phase* (and decide whether
  to hard-redirect the pages) before the nav is restored. Relates: `supabase/migrations/group_timetables.sql`,
  `app/learn/courses/[id]/page.tsx` (link removed), `app/admin/courses/[id]/layout.tsx` (tabs removed).

## Recently resolved

<!-- EXAMPLE (move resolved items here with their closure ref):
- **OQ-000** — <the question> → RESOLVED <YYYY-MM-DD> by <commit / ADR-NNNN / log entry>.
-->
