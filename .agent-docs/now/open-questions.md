---
provenance: llm-reviewed
created: 2026-07-03
last-modified: 2026-08-13
tags: [current, open-questions, rls, security]
related: [status, work-plan]
last-modified: 2026-08-17
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
  **Complete diff measured 2026-08-20 (multi-tenancy session, via REST OpenAPI on both projects):**
  staging is missing **11 whole tables** vs prod — `ai_coach_sessions`, `ai_coach_messages`, `attendance`,
  `course_groups`, `course_group_members`, `course_phases`, `moderator_cohort_assignments`, `reflections`,
  `settings`, `timetable_entries`, `timetable_entry_overrides` — **and ~30 columns** across 9 tables
  (`courses`: access_type/course_type[now patched]/ai_coach_enabled/ai_coach_instructions/deadline_date/
  deadline_days/outcomes/show_cohort_comparison/timetable_*; `lessons`: chapters/audio_url/duration_seconds/
  phase_id/skills/slides_*/document_*/what_you_learn; `enrollments`: status/suspend_*; `assignments`:
  max_score/template_url/is_group_assignment; `profiles`: last_seen_at/salesforce_url; plus quizzes,
  submissions, announcements, question_bank). Reverse drift: prod is missing `course_reminder_logs`.
  **Proper fix (recommended):** staging holds **0 rows**, so rebuild its `public` schema from prod —
  `pg_dump --schema-only` (or Supabase branch/clone) prod → reset+apply to staging → re-apply the 4
  committed multi-tenancy migrations (0a/0b/0c/phase1). This needs operator DB access (REST can't run DDL).
  **Bridge available:** a tables-only catch-up assembled from committed migration files (scratchpad
  `staging_catchup_tables.sql`, idempotent) covers 10/11 missing tables + `settings`, but NOT the columns.

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

- **OQ-011** (✅ **RESOLVED 2026-08-20** — prod REST OpenAPI introspection shows `enrollments.status` +
  `suspend_reason`/`suspended_at`/`suspended_by` all exist on prod, so `enrollment_suspension.sql` WAS
  applied to prod; the pages that select `enrollments.status` are safe. Staging is missing these columns,
  but that's the OQ-008 divergence, tracked there.) ~~(🔴 blocking-verify; surfaced 2026-08-14)~~ — **Is `supabase/migrations/enrollment_suspension.sql`
  applied to the prod DB?** The WU-0005 code (shipped to `main` via #282) **selects `enrollments.status`**,
  which the migration adds. Migrations are hand-applied (`memories/migrations-applied-by-hand.md`), and it
  is unconfirmed whether the operator has run it. **Until applied, these pages 500:** admin
  learners/progress/analytics(gradebook)/quizzes; learner course overview + lessons + all sub-tabs
  (resources/discussions/feedback/capstone/timetable). **Resolve:** service-role REST read
  `enrollments?select=status&limit=1` → a `status` field = applied; `42703 column ... does not exist` = NOT
  applied → run the block (in `now/handoff.md` + PR #281 body; idempotent, additive). Sub-question: do
  staging and prod share the same Supabase project (`mmkmsudwtrqdzehnfctx` is the `.env.local` target =
  prod)? If shared, applying once covered both. Relates: OQ-008.

- **OQ-012** (🟢 product/accuracy; surfaced 2026-08-14) — The **learner-facing "cohort average"** on the
  course overview (`app/learn/courses/[id]/page.tsx` inline `cohortAvgPct` + the `getCourseStats` RPC) was
  **NOT touched** — it still counts suspended learners (and predates the staff-exclusion work). Admin
  stats and the roster ARE fixed; this is the one learner-visible number that isn't. **Resolve:** extend
  the `role='learner'` + `status='active'` filter into that RPC / inline calc, or accept it as display-only
  noise. Relates: #280, #281, `lib/filter-learner-ids.ts`, `lib/analytics/course-stats.ts`.

- **OQ-013** (🟢 product; surfaced 2026-08-14) — **Account-level suspension** (Option B) was offered and
  NOT built. `profiles.status` exists (`pending`/`active`) but is **informational only** — it renders a
  banner in `app/learn/layout.tsx` and enforces nothing. WU-0005 implemented COURSE-level suspension only
  (`enrollments.status`). **Resolve:** decide whether a whole-platform ban is needed; if so, add a
  `'suspended'` value to `profiles.status` and actually enforce it (learn layout + middleware + API).

- **OQ-014** (🟠 data; surfaced 2026-08-17) — **17 learners are still stranded** by the (now-fixed)
  invitation-accept-before-enroll bug (WU-0006): they signed up, their invite is `status='accepted'`, but
  they have **no enrollment row → no course access, invisible in rosters.** 16 are on *Teacher Leadership
  Academy 2026* (`88450829-1694-480e-9afa-9bb44800bc47`), 1 more on the Welcome course
  (`ed7e3fd0-11ea-4432-a52d-5cb6faaff2b7`). Tatev was already backfilled; the other 17 were left per
  operator decision. **Resolve:** backfill their enrollments (upsert `enrollments{user_id,course_id}` via
  service-role REST — see handoff §Immediate-next for the diff recipe + full list), or decide they should
  stay out. The code fix (#283) stops NEW strandings but does **not** retro-fix these — their invites are
  `accepted`, so auto-enroll never revisits them. Relates: WU-0006, `lib/invitations/accept-pending.ts`.

## Recently resolved

- **OQ (session 2026-08-17, no number)** — "Why was tatev@teachforarmenia.org invited but not enrolled /
  no access?" → RESOLVED 2026-08-17: the auto-enroll-on-visit code marked her invite `accepted` in
  parallel with a **failed** enrollment upsert (unchecked `Promise.all`), permanently stranding her.
  Fixed her data (enrollment row created in prod) + root cause (WU-0006, PR #283). Systemic: 18 total
  stranded; the remaining 17 tracked as OQ-014.

- **OQ (session 2026-08-14, no number assigned)** — "Are TLA-2026 moderators enrolled as learners by
  default, or manually?" → RESOLVED 2026-08-14: **manually.** No code path auto-enrolls a moderator (the
  three role→course link tables are separate; admin create-user branches correctly), and the course is
  `access_type='private'` so self-enroll is impossible (`/api/enrollments/enroll` 403s private courses).
  The 11 stray enrollments were admin-created; operator unenrolled them. Durable fix shipped as WU-0005.

<!-- EXAMPLE (move resolved items here with their closure ref):
- **OQ-000** — <the question> → RESOLVED <YYYY-MM-DD> by <commit / ADR-NNNN / log entry>.
-->
