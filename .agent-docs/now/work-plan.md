---
provenance: llm-reviewed
created: 2026-07-03
last-modified: 2026-08-13
tags: [current, work-plan, decisions]
related: [status, open-questions]
last-modified: 2026-08-20
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
> **🎯 Multi-tenancy Phase 0 + Phase 1 — ALL SHIPPED TO STAGING (WU-0007 + WU-0008).** ADR-0004
> (Shopify console/storefront; organizations + owner-named spaces; one identity + `org_members`/
> `space_members`; denormalized `org_id` + flat RLS deferred to pre-Phase-2). Migrations 0a/0b/0c/phase1
> applied to staging DB; code merged via #285 + #286. Phase 2 (GTM: domains/billing/white-label)
> **DEFERRED** (WU-0009 / `memories/phase-2-multi-tenant-gtm-deferred.md`).
> **NEXT (operator):** (1) test the space flows on `staging.dasavandir.org` (spaces manager, learner→
> space assignment, space-scoped `/courses`, course Space picker); (2) when good, "push to main" →
> promote `staging → main` AND apply the 4 multi-tenancy migrations + a prod org_id backfill to the PROD
> DB (prod already has access_type/course_type). (3) **OQ-008 proper fix:** rebuild staging's schema
> from prod (staging is empty — safe) so it's a trustworthy test bed; bridge catch-up assembled in
> scratchpad `staging_catchup_tables.sql`. Doc-store (ADR-0004 + memory + these updates) committed to `main`.
>
> **🅿️ Parked (WU-0006) — invitation-accept-before-enroll fix is on `staging` only.** PR #283
> (`fba7a65`) merged to `staging`. **NEXT:** operator tests on `staging.dasavandir.org`, then says
> "push to main" → open a `staging → main` promotion PR and merge. Do NOT push to `main` without an
> explicit go. **Offer to backfill the 17 still-stranded learners (OQ-014)** — Tatev is already fixed;
> the other 17 (16 on TLA 2026, 1 more on Welcome) still have no access. Backfill = upsert
> `enrollments{user_id,course_id}` per the handoff §Immediate-next recipe.
>
> **🎯 Prior open loop (WU-0005, untouched this session) — a hand-applied migration.** Confirm
> `supabase/migrations/enrollment_suspension.sql` is applied to the prod DB — the code selects
> `enrollments.status`; until the column exists, admin learners/progress/analytics/quizzes + learner
> course pages 500. Verify: service-role REST read `enrollments?select=status&limit=1` (→ `42703` if not
> applied). Then click-test suspend/reactivate on prod.
>
> **Optional follow-ups (OQ):** OQ-012 (learner-facing cohort average still counts suspended/staff),
> OQ-013 (account-level suspension), OQ-009 (move-learner control), OQ-010 (timetable rework).

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
