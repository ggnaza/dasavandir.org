---
provenance: llm-reviewed
created: 2026-07-03
last-modified: 2026-08-13
tags: [current, work-plan, decisions]
related: [status, open-questions]
last-modified: 2026-08-21
---

# Work plan — dasavandir.org

## The plan (phases / milestones)
- Fieldbook context store: install + backfill — ✅ done + shipped to `main`+`staging` (#267, #268).
- Asana Build Agent — ✅ disabled at operator request (2026-08-12).
- Creator timetable (weekly tabs + time ripple) — shipped (commit 614abc3); feature branch
  `feat/timetable-week-view` still checked out.
- Security audit follow-through (2026-07) — open, operator-owned (OQ-001..003).
- (Optional) AI PR-review agent — proposed, not built (OQ-006).

## Locked decisions (this cycle)
- Role→course access uses three role-specific link tables, never one shared table — `ADR-0001`.
- Only the `.agent-docs/` memory is git-tracked; the `.claude/` engine stays local (protects a token).
- Fieldbook changes ship on their own branch/PR, separate from feature work.
- Fieldbook store promoted to production (`main`), scoped to only the store (staging==main beforehand).
- Asana Build Agent (`build-agent.yml`) is OFF — `memories/asana-build-agent-is-disabled.md`.

## Immediate next
> **✅ Multi-tenancy + spaces + space_manager + learner profile — ALL LIVE ON PROD (2026-08-21).**
> Nothing is mid-flight; the tree is clean on `main`. The operator has been shipping directly to prod
> and applying each migration. **Operator should click-test on prod** (no creds here to verify authed
> flows): assign a `space_manager` + a space, sort real courses/learners into HR/Recruitment spaces, and
> try `/learn/profile` (edit + avatar upload).
>
> **Pick-next menu (all self-contained unless noted):**
> - **Space_manager slice 2 (WU-0010 follow-up)** — scope the GLOBAL views (`/admin/submissions`,
>   `/admin/learners`, `/admin/analytics`, capstones) to a manager's spaces via `getManagedSpaceIds`,
>   then re-add them to the space_manager nav. Pattern seam: `checkCourseAccess` + the fetch-map in
>   `app/admin/courses/page.tsx`. CLAUDE.md §Role-to-course-linking has the deferral note.
> - **Certificates fully (#5)** — verifiable ID + public verify URL + PDF export + per-org custom-design
>   upload. Self-contained.
> - **i18n string-list (#1)** — extract ~145 hardcoded components into `lib/i18n.ts` keys + a CSV/Sheets
>   export-reimport script. Mechanical, large.
> - **Payments (#4)** — BLOCKED on operator decision: gateway (local VPOS/ArCa/Idram vs Stripe) +
>   billing scope (learner vs org). Spec first, then build.
> - **Tech support (#3)** — in-app support form → ticket + email; FAQ/help.
> - **Multi-tenancy Phase 2 (WU-0009)** — domains/billing/white-label; DEFERRED, needs 2 decisions
>   (neutral base domain; who collects payment in another org's storefront).
>
> **OQ-008 loose end:** staging catch-up (`staging_full_catchup.sql`) was applied, but the FINISH block
> (`scratchpad/staging_finish.sql` = org_id on the 11 newly-created staging tables + `timetable_entries.source_key`
> + `space_manager_access` on staging) is **NOT confirmed applied to staging**. Prod is fine; staging still
> slightly behind. Re-diff via REST after it's run.

## Work-unit spine

| WU | Objective | Depends | Status |
|---|---|---|---|
| WU-0001 | Install + backfill the Fieldbook context/memory store | — | ✅ done (#267, #268 merged) |
| WU-0002 | Creator timetable: weekly tabs + time ripple | — | done (614abc3) |
| WU-0003 | RLS recursion + auth trigger / policy hardening | — | ✅ done — recursion fix applied to staging + prod (verified live), files on `main` (PR #271). Stage-3 remainder deferred (OQ-007). ADR-0002 accepted. |
| WU-0004 | Course phases (TLA → Regional Orientation) — per-phase groups, phase-tagged lessons, phase-scoped review + notifications, hide timetable | — | ✅ done — shipped to prod (`main` #273 + #274) + staging (#272); prod migration applied; TLA lessons tagged. ADR-0003 accepted (on `origin/main`, not this local branch). |
| WU-0005 | Moderators-skew-stats fix + learner suspension: (a) staff view courses without enrollment; (b) exclude non-learner roles from per-course stats; (c) reversible course-level suspension (`enrollments.status`) so unenroll ≠ data loss | — | ✅ code shipped to prod (`main` #282 = #280 + #281). ⏳ **migration `enrollment_suspension.sql` NOT confirmed applied to prod** (OQ-011). |
| WU-0006 | Invitation-accept-before-enroll bug: auto-enroll marked invite `accepted` in parallel with (and blind to) the enrollment upsert → users stranded with no enrollment + no access, never retried. Extract `lib/invitations/accept-pending.ts` (accept only after enroll succeeds); wire all 3 auto-enroll sites | — | ✅ code merged to `staging` (#283 `fba7a65`); ⏳ pending promote to `main`. Tatev's data fixed in prod; **17 other stranded learners not backfilled** (OQ-014). |
| WU-0007 | **Multi-tenancy Phase 0 — foundation (INVISIBLE).** `organizations` + `org_members` + `spaces` tables; insert AEI as org #1; `org_id` denormalized + backfilled onto all tenant tables. No UX change (one org, everything → AEI). Staging-first, hand-applied, idempotent sub-migrations. ADR-0004. | — | ✅ **applied + verified on STAGING** (2026-08-20): 0a (orgs/spaces/org_members + AEI seed + self-read RLS), 0b (courses.org_id), 0c (org_id on all remaining tables via guarded DO-loop). 31 tables now carry `org_id`, 0 missing. **⚠️ staging is missing 11 tables that exist on prod** (course_groups/phases, timetable*, ai_coach_sessions/messages, moderator_cohort_assignments, course_group_members, reflections, attendance, settings) — OQ-008 divergence; migration guards skipped them; they'll be covered when 0a–0c run on PROD. **`auth_org()` + org_id RLS enforcement + NOT NULL deliberately DEFERRED to pre-Phase-2** (zero value with one org; risks NULL-org rows vanishing before app stamping). **NOT yet on prod; not yet committed to git.** |
| WU-0008 | **Multi-tenancy Phase 1 — spaces (the feature).** Owner-named `spaces` (AEI seeds Learning / HR Onboarding / Recruitment); `courses.space_id` + `space_members`; space-scoped catalog (public/paid in your spaces + private-if-enrolled); learner→space assignment UI; auto-add on enrol; org/space write-stamping. Single domain, no console/storefront split, no billing. ADR-0004. | WU-0007 | ✅ **all 4 slices merged to STAGING** (2026-08-20): #285 (slice 1 — spaces manager + course→space picker), #286 (slices 2+4 — space-scoped catalog, learner→space assignment via ManageSpacesModal, auto-add on enroll, org_id/space membership stamping via ensureProfile/ensureOrgMembership). Migrations phase1 applied to staging. QA (data-level): space scoping + FK delete-guard verified; tsc clean. **Not on prod.** Also required a staging schema patch (access_type/course_type — OQ-008). |
| WU-0009 | **Multi-tenancy Phase 2 — go-to-market machinery. DEFERRED** (not built now). Console/storefront domain split, tenant-resolution middleware, neutral-base subdomains, custom domains + SSO hand-off, per-org storefront editor, org signup/provisioning, subscription billing + coupons, white-label. Come back only when onboarding the first external customer. | WU-0008 | 🅿️ DEFER — memorized in `memories/phase-2-multi-tenant-gtm-deferred.md` |
| WU-0010 | **Space subtabs + retire course_type + `space_manager` role** (ADR-0005). Admin courses split by space subtabs; course_type toggle removed (column kept, invite-only via access_type=private); new role `space_manager` + `space_manager_access(manager_id, space_id)` → sees/creates/manages courses in their space via `checkCourseAccess`; assign-managed-spaces UI. | WU-0008 | ✅ **LIVE ON PROD** — code #288→#289 (staging→main), role-assign hotfix #290→#291 (missed the `/api/admin/users` zod enum), `space_manager_access.sql` applied to prod. **Slice 2 DEFERRED:** global aggregate views (submissions/learners/analytics/capstones) not yet space-scoped → nav is Courses-only. ADR-0005 (proposed). |
| WU-0011 | **Learner profile page** `/learn/profile` — name/avatar(public `avatars` bucket)/region/LinkedIn(URL only)/bio/language/password; own-row writes via service-role (no role/status/email → no self-escalation); name in nav links to it (standalone tab removed). | — | ✅ **LIVE ON PROD** — #292→#293 (profile) + #294→#295 (name→profile link). `profiles_profile_fields.sql` applied to prod (4 cols + avatars bucket). tsc clean; authed click-through NOT done here (no creds). |
