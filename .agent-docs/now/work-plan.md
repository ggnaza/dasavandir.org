---
provenance: llm-reviewed
created: 2026-07-03
last-modified: 2026-08-13
tags: [current, work-plan, decisions]
related: [status, open-questions]
last-modified: 2026-09-07
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

> **FIX BUG FIRST:** `middleware.ts:50` has `efficacy.staging.dasavandir.org` — must be
> `staging.efficacy.dasavandir.org`. One-line change, PR to staging.
>
> **Then: operator tests efficacy on `staging.efficacy.dasavandir.org`** — log in → role-based
> redirect → LDM/teacher dashboards → observation wizard → competency evaluation.
>
> **On operator go:** promotion PR `staging → main` (26+ commits: Ararka fixes #318–#324 + efficacy
> #310, #311, #325 + the middleware fix).
>
> **Pick-next menu (all self-contained unless noted):**
> - **Efficacy Phase 4** — Correlation dashboard (SQL view joining practice scores to LMS learning
>   scores). Deferred.
> - **Efficacy remaining features** — AI evaluations (video processing + RAG), knowledge base (Drive
>   sync), PDF export, voice-to-text, growth chart (SVG). All deferred.
> - **Space_manager slice 2 (WU-0010 follow-up)** — scope global views to manager's spaces.
> - **Certificates (#5)** — verifiable ID + public verify URL + PDF export.
> - **i18n (#1)** — extract ~145 hardcoded components into `lib/i18n.ts` keys.
> - **Payments (#4)** — BLOCKED on operator decision: gateway + billing scope.
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
| WU-0012 | **Landing-page CMS: structured block editor.** Admin edits the public marketing site through a typed block schema, not a freeform drag-and-drop canvas. ADR-0006. | — | 📋 proposed — ADR `status: proposed`, not started. |
| WU-0013 | **Course payments: order → checkout → enrol behind a pluggable, env-gated provider** (mock now, real gateway later). ADR-0007. | — | 📋 proposed — ADR `status: proposed`, not started; gateway choice still an operator decision (see §Immediate next "Payments"). |
| WU-0014 | **Ararka brought up on staging** — 7 defects fixed (PRs #318–#324): OAuth redirect origin, upload UX + multi-PDF, AI key env-var names, the 4.5MB Vercel body limit (removed via direct-to-Supabase-Storage upload), model-picker selection, and stale Gemini model ids. | — | ✅ merged to `staging` (`348e1f5`); ⏳ pending operator retest + promotion to `main`. Follow-ups: OQ-015…OQ-020. |
| WU-0015 | **Teacher Efficacy Tool — Phase 2 (frontend) + Phase 3 (subdomain routing).** 16 new page/component files (~2750 lines): LDM dashboard + 6-step observation wizard + competency evaluation + behavior classification chat + teacher dashboard + reflection wizard + AI coaching chat + admin management + AI config. Subdomain routing via middleware rewrite (`efficacy.dasavandir.org` → `/efficacy`), CSRF cross-subdomain allowlist, nav prefix stripping. | — | ✅ merged to `staging` (PRs #310, #311, #325); ⚠️ **BUG:** `middleware.ts:50` still has wrong staging subdomain — must fix before testing. ⏳ pending operator test + promotion to `main`. |
