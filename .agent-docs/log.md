---
provenance: kit-template
created: 2026-07-03
last-modified: 2026-07-03
tags: [log, journal]
---

# Operational log — dasavandir.org

<!-- THE one canonical operational journal. It lives HERE, at the `.agent-docs/` root (not under
     `now/`, not per-directory). There is exactly one log; append to it, never fork it.

     Append-only. NEWEST ENTRY AT THE TOP (directly under this note). One entry per session or
     operation. Keep the heading grep-parseable:

         ## YYYY-MM-DD | <op / session label> — <one-line summary>
         <a short paragraph: what happened, the commits, what's next.>

     A rejected lesson proposal logs its one-line reason here (see now/lessons/proposals.md). -->

## 2026-08-17 handoff | WU-0006 — invitation-accept-before-enroll bug fixed → staging
Operator report: tatev@teachforarmenia.org invited, email received, but not in the enrolled list + no
access. Forensics (Supabase REST, service-role, prod `mmkmsudwtrqdzehnfctx`) found the auto-enroll-on-
visit code (`/learn`, course page, lesson page) marked the invite `status='accepted'` in a `Promise.all`
concurrent with — and blind to — the enrollment upsert. A failed enrollment left the invite `accepted`,
and auto-enroll only reprocesses `pending`, so the user was permanently stranded. Fixed Tatev's data
(created her enrollment row in prod) + root cause: new `lib/invitations/accept-pending.ts` (mark accepted
only after enroll succeeds), wired into all 3 sites. Merged to `staging` as PR #283 (`fba7a65`).
Found 18 stranded total; 17 left un-backfilled (OQ-014). Pending: promote #283 to `main` on operator go.

## 2026-08-17 decision | Backfill only Tatev; fix root cause + PR to staging
Operator chose to fix only the reported learner (Tatev) and NOT backfill the other 17 stranded learners
now (tracked OQ-014), and to fix the root-cause code + PR to staging (not straight to main, per the
default-target-branch rule). Branch cut off `origin/staging` because staging is ahead of main (#280/#281
staff-access logic) and a main-based branch would clobber it.

## 2026-08-14 handoff | WU-0005 — staff-stats fix + learner suspension shipped to prod
Started from an operator question: moderators enrolled as learners in "Teacher Leadership Academy 2026"
(`88450829…`) were skewing progress stats. Forensics (service-role REST) showed it was MANUAL admin
enrollment, not a default — the course is `access_type='private'`, so self-enroll is impossible; 13 staff
had course access, 11 also held learner enrollments. Operator unenrolled the 11. Then shipped two fixes to
prod: **#280** — staff view courses without enrollment (`checkCourseAccess` bypass) + exclude `role!='learner'`
from per-course stats (new `lib/filter-learner-ids.ts`); **#281** — course-level learner suspension
(`enrollments.status`, reversible, keeps data) with migration + `PATCH /api/admin/courses/[id]/enrollments`
+ access gates + roster toggle. Promoted `staging→main` via **#282** (`72f46be`). ⚠️ OPEN: the migration
`enrollment_suspension.sql` is hand-applied and UNCONFIRMED on prod — code selects `enrollments.status`;
verify first next session (OQ-011). Gate: `tsc --noEmit` clean; full build needs `--max-old-space-size=8192`.

## 2026-08-14 decision | Stats-exclusion by role; suspension course-level
Excluded staff from learner stats by profile ROLE (`role='learner'` only), not per-course access — mirrors
the existing global analytics page; accepted the edge case that a course_manager who learns elsewhere is
also excluded. Chose COURSE-level suspension (`enrollments.status`) over account-level (`profiles.status`
is informational-only, enforces nothing); account-level offered but deferred → OQ-013.

## 2026-08-21 handoff | Multi-tenancy + spaces + space_manager + learner profile ALL shipped to PROD

Marathon build session, design→prod. Shipped to `main`/prod (operator applied every migration + pushed
directly to prod for the later features): **multi-tenancy Phase 0+1** (ADR-0004 — organizations/spaces/
org_members/space_members, AEI as org #1, `org_id` everywhere, space-scoped `/courses`, learner→space
assignment, write-stamping; prod backfill verified 144 users + 10 courses, 0 nulls); **admin course
space subtabs + `course_type` retired**; **`space_manager` role** (ADR-0005 — `space_manager_access`,
"admin of a space" via `checkCourseAccess`; foundation only, slice-2 global-view scoping deferred);
**learner profile** `/learn/profile` (name/avatar/region/LinkedIn/bio/language/password) + name-in-nav
links to it. Migrations to prod: `multitenancy_phase0a/b/c/phase1`, `space_manager_access`,
`profiles_profile_fields`. PRs #287,#289,#291,#293,#295 (+ #285/#286/#288/#290/#292/#294 to staging).
Docs on `main`: ADR-0004, ADR-0005, CLAUDE.md role-linking table updated, phase-2 memory. OQ-011
RESOLVED (enrollments.status confirmed on prod). OQ-008 sharpened + staging catch-up applied (finish
block pending). Gate = `tsc --noEmit` throughout (no eslint/prettier/pre-commit; `next build` OOMs).
**Could NOT authed-click-test** (no creds) — operator verifies on prod.

decision | 2026-08-20 | Multi-tenancy = organizations + owner-named spaces on the Shopify console/
storefront model; one identity + `org_members`/`space_members`; denormalized `org_id` + FLAT `auth_org()`
RLS (NOT join-derived — avoids the ADR-0002 recursion class). RLS enforcement + NOT NULL deferred to
pre-Phase-2 (zero value with one org). Phase 2 (domains/billing/white-label) deferred. ADR-0004.

decision | 2026-08-20 | `space_manager` = dedicated role + `space_manager_access(manager_id, space_id)`
table (parallels course_manager one level up), NOT `space_members.role` (keeps that learner-only) and
NOT org-admin. Access via the shared `checkCourseAccess`. ADR-0005.

decision | 2026-08-20 | `course_type` (program/internal) retired — spaces do the categorising; internal
≈ private. Toggle removed, column kept, no data migration (operator: "managed with the space").

decision | 2026-08-21 | LinkedIn on the profile is URL-only (no live import — LinkedIn's API is gated).

memory | 2026-08-20 | Prod introspection (service-role REST OpenAPI `/rest/v1/`) is the reliable way to
verify a hand-applied migration landed + to diff staging↔prod schema. Used it all session; captured the
full OQ-008 diff this way. `Date.now()`/`new Date()` fine in app code (unlike workflow scripts).

## 2026-08-13 lesson | LP-005 accepted; LP-003 broadened

LP-005 (medium) — a Next App Router client component's `useState` is NOT reset when `router.refresh()`
passes new props; derive an effective value from props with a fallback. Promoted to
`lessons/client-usestate-not-reset-on-router-refresh.md`. LP-003 broadened from "verify live pg_policies
before a policy migration" to "verify the live schema (policy names AND table existence) before ANY
migration" — evidence: the `42P01 course_groups does not exist` staging failure (staging lacks the whole
groups feature). Proposals drained; lessons/index.md updated.

## 2026-08-13 handoff | WU-0004 course phases (TLA → Regional Orientation) shipped to prod

Designed + shipped course phases (ADR-0003): a course runs ordered phases via a `course_phases` table +
nullable `lessons.phase_id` / `course_groups.phase_id`; one group per learner per (course, phase);
moderator submissions queue scoped to their phase(s) with untagged-lessons-visible-to-all; reviewer
attribution + submit-email + cron routed by the assignment lesson's phase; groups UI phase tabs + phases
CRUD; lesson editor phase dropdown; timetable nav hidden. Shipped to staging (#272) then prod via a
clean cherry-pick onto main (#273); operator applied `course_phases.sql` to prod, seeded TLA phases,
moved existing groups to the TLA phase, tagged the 9 `ՏԿ | ԻՈՒ` lessons Regional Orientation. Follow-up:
multi-select add-members (#274). Surfaced: staging lacks the entire groups feature (OQ-008 sharpened);
new OQ-009 (move-learner-between-groups control) + OQ-010 (timetable hard-gate). Gate = `tsc --noEmit`
(no eslint/prettier in repo). Local tree still on the stale `fix/rls-*` branch; ADR-0003 lives on
`origin/main`, not this local branch.

decision | 2026-08-13 | Course phases modelled inside ONE course (not a separate course, not a bare
smallint) — a `course_phases` table homes per-course phase names; a course with no phase rows behaves
exactly as today. Operator dropped phase-privacy then chose it back (Option 2: queue scoped per phase).
ADR-0003 (on origin/main).

decision | 2026-08-13 | Phases feature shipped straight to PROD (not staging-first) because staging is
missing the entire groups feature — the operator authorised the prod path.

## 2026-08-13 lesson | LP-003 + LP-004 accepted (promoted to lessons/)

LP-003 (high) — verify live pg_policies per-env before a policy migration on a hand-applied schema
(repo ≠ live, staging ≠ prod; DROP-by-name silently no-ops on a name mismatch). LP-004 (medium) — check
`git log <target>..HEAD` before a PR so a feature-based branch doesn't drag its feature in. Both seedling,
llm-reviewed. Indexed in lessons/index.md; proposals drained.

## 2026-08-13 handoff | WU-0003 RLS recursion fix shipped (staging+prod+main); stage-3 deferred

Fix live on staging + prod (verified against live pg_policies), files on `main` via PR #271 (`8a7f755`)
on a clean main-based branch `fix/rls-recursion-prod` (worktree — avoided bundling the timetable branch).
No app code / no deploy. ADR-0002 accepted; memory + OQ-007/008 filed. Deferred: OQ-007 stage 3 (helper
conversion / make RLS load-bearing), OQ-008 (schema-drift ledger). Working tree still on the timetable-
based `fix/rls-recursion-and-auth-hardening` with uncommitted `.agent-docs/` store edits.

## 2026-08-13 | WU-0003 apply — RLS recursion fix live on staging + production

Verified (read-only pg_policies) then applied `is_admin()` + the 4 back-edge rewrites. STAGING:
applied, validated in-app (admin/creator/learner + Kaits course-settings save). PROD: verified first
and caught real drift — prod's enrollments back-edge is `"Admins view all enrollments"` (FOR SELECT),
not staging's `"Admins manage all enrollments"` (FOR ALL); the staging block would have silently missed
it, so prod got a tailored block. Prod's trigger ALREADY had the email role-inheritance (Option A) → no
trigger change needed on prod. Prod also MISSING the two manager-visibility policies staging has (noted
under OQ-008, not recursion). Updated the committed `fix_rls_recursion.sql` to the prod-accurate
enrollments name (drops both). ADR-0002 → accepted. NEXT: prod in-app smoke check, then commit + PR the
files to main. Stage 3 (full helper conversion / make-RLS-load-bearing) deferred by decision (OQ-007).

## 2026-08-12 | WU-0003 RLS/auth review — found + fixed the profiles recursion, trigger drift, policy syntax bug

Full read of all 48 migrations + `staging-setup.sql`/`schema.sql` + auth code. Findings: (F1, 🔴) the
authenticated-role RLS layer recurses (42P17) through `profiles` — the live bootstrap
`staging-setup.sql:452` has a policy ON profiles that reads profiles, plus 3 admin back-edges
(enrollments/cca/cma); the app survives only on the service-role client → no defense-in-depth. This is
the Kaits (#261) "profiles RLS recursion" and was previously tracked but lost in an OQ renumber. (F2,
🔴 landmine) FIVE divergent `handle_new_user()` bodies; 2 violate CLAUDE.md — `fix_profile_trigger.sql`
read role from signup metadata (privilege escalation) + no outer EXCEPTION, `security_fixes.sql` C-2 no
outer EXCEPTION. The LIVE trigger (staging-setup) is the safe one, so this is a re-paste footgun, not an
active fire. (F3, 🟠) `features_v2.sql` used invalid `CREATE POLICY IF NOT EXISTS`. (F4/OQ-008) three
divergent schema sources with no applied-migrations ledger. Wrote: `fix_rls_recursion.sql` (is_admin()
SECURITY DEFINER + rewrite the 4 back-edges, semantically identical, idempotent — ADR-0002);
`consolidate_handle_new_user.sql` (canonical safe trigger); defused `fix_profile_trigger.sql`; fixed the
`features_v2.sql` syntax. Persisted ADR-0002, memory rls-policies-recurse-through-profiles, OQ-007/OQ-008.
Branch `fix/rls-recursion-and-auth-hardening`. NEXT: operator runs the read-only verification pack
(`scratchpad/rls_verification.sql`) against prod, then applies in order with a signup smoke-test. No DB
change applied yet — Claude cannot run DDL; all applies are operator-gated.

## 2026-08-12 | WU-0001 backfill — seed the store with real project history

ingest + decision + memory. Backfilled the freshly-restored store from durable sources (`CLAUDE.md`,
`AUDIT_REPORT.md`, git history): ADR-0001 (three-table role→course access, accepted); memories
(auth-trigger-must-swallow-errors, current-user-role-read-needs-admin-client, migrations-applied-by-hand);
reference (architecture-overview, security-audit-2026-07-open-items); OQ-001..004 (leaked service-role
key, xlsx, Upstash, plaintext PAT). Updated now/{status,work-plan,handoff,open-questions}. Doc-lint clean.

## 2026-08-12 | WU-0001 install — restore the Fieldbook context store

work. The `.agent-docs/` store was missing; restored Standard-profile v0.8.2 (31 files), committed on
`chore/fieldbook-context-store` → PR #267 (base `staging`). `.claude/` engine is git-ignored (local
only). Additively added kit-doctor/kit-upgrade skills + dispatch-gate hook; brought lint-docs.py +
lint-agent-docs-indexes.sh to v0.8.2 and fixed a space-in-path bug in the index-lint. Backups under
`.kit-backups/20260812T221816Z/`.

## 2026-08-12 | handoff — Fieldbook store shipped to main+staging; Asana Build Agent disabled

work + decision + memory. Merged PR #267 (chore→staging) and #268 (staging→main) — `.agent-docs/` now
tracked on both (staging==main beforehand, so only the store was promoted). Disabled the Asana Build
Agent workflow (`gh workflow disable "Build Agent"` → `disabled_manually`); its recent scheduled runs
were failing. Filed `memories/asana-build-agent-is-disabled.md`, OQ-005 (Build Agent failures),
OQ-006 (no AI review agent). No app code changed. Doc-lint clean.

## 2026-08-12 | lesson — promoted LP-001, LP-002 to the ledger

lesson. Operator accepted both handoff proposals: LP-001 (git-diff no-diff is a false all-clear on an
ignored path) and LP-002 (committing untracked files hides them on branch switch). Moved to
`lessons/`, indexed, cleared from `now/lessons/proposals.md`. Both seedling (not MOC-promoted).

## 2026-08-20 | feat — multi-tenancy Phase 0 + Phase 1 shipped to staging (WU-0007, WU-0008)

Designed + built the org/space multi-tenancy model (ADR-0004; Shopify console/storefront, one identity
+ `org_members`/`space_members`, denormalized `org_id`, RLS enforcement deferred to pre-Phase-2). Phase 0
(orgs/spaces/members + `org_id` on all tenant tables + AEI backfill) and Phase 1 (space_members,
`courses.space_id`, space-scoped catalog, learner→space assignment UI, auto-add on enrol, org/space
write-stamping via `ensureProfile`/`lib/org.ts`) — migrations 0a/0b/0c/phase1 applied to staging DB; code
merged to `staging` via #285 + #286. QA (data-level, service-role REST): space scoping + FK delete-guard
verified; `tsc --noEmit` clean; reachability confirmed. Could NOT test authed admin UI (no creds) or the
`access_type` filter live (staging lacked the column). Flow model published as an Artifact ("dasavandir
Tenancy Flows"). Phase 2 (domains/billing/white-label) deferred → `memories/phase-2-multi-tenant-gtm-deferred.md`.
**OQ-008 sharpened** with the complete prod↔staging diff (11 tables + ~30 columns missing on staging) +
a rebuild-from-prod remediation. **OQ-011 RESOLVED** — prod introspection confirms `enrollments.status`
exists on prod. Not on prod yet (Phase 0/1 is staging-only pending operator test + "push to main").

<!-- newest entries appended above this line -->
