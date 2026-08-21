---
provenance: llm-reviewed
created: 2026-07-03
last-modified: 2026-08-21
tags: [current, status, multi-tenancy, spaces, space-manager, profile]
related: [work-plan, open-questions, handoff]
---

# Status — dasavandir.org · Multi-tenancy + spaces + space_manager + learner profile ALL SHIPPED TO PROD · 2026-08-21

## TL;DR
A long build session took the multi-tenancy roadmap from design to **production**. Everything below is
**live on `main`/prod** (verified: prod HTTP 200, schema introspected via service-role REST):
- **Multi-tenancy Phase 0 + Phase 1** (ADR-0004): `organizations` + `spaces` + `org_members` +
  `space_members`; AEI seeded as org #1; `org_id` on all tenant tables; space-scoped `/courses`;
  learner→space assignment; org/space write-stamping. Prod backfill verified (144 users → org+Learning
  space; 10 courses → org+Learning; 0 nulls).
- **Admin courses split by space subtabs**; **`course_type` retired** (toggle removed, column kept).
- **`space_manager` role** (ADR-0005) — "admin of a space": `space_manager_access(manager_id, space_id)`;
  sees/creates/manages courses in their space via the shared `checkCourseAccess` guard. **Foundation
  only** — global aggregate views (Submissions/Learners/Analytics/Capstones) NOT yet space-scoped (their
  nav is Courses-only). = **slice 2, deferred.**
- **Learner profile page** `/learn/profile` — name/avatar/region/LinkedIn/bio/language/password; the
  user's **name in the nav links to it** (the standalone Profile tab was removed).

## Migrations applied to PROD this session (all idempotent, operator-run)
`multitenancy_phase0a/0b/0c/phase1`, `space_manager_access.sql`, `profiles_profile_fields.sql`
(profiles: avatar_url/region/linkedin_url/bio + public `avatars` bucket). All verified present via REST.

## Branch / working tree
- On **`main`** (`90041cf`), up to date with `origin/main`. Working tree clean except
  `tsconfig.tsbuildinfo` (build artifact — ignore/discard). All feature branches merged.
- Doc store (ADR-0004, ADR-0005, CLAUDE.md role-linking update, memory) committed to `main`.

## Gates
- `tsc --noEmit` is THE gate (no eslint/prettier configured, no active pre-commit hook; `next build`
  OOMs — use `NODE_OPTIONS=--max-old-space-size=8192 npm run build` only for a full build). Every feature
  this session was tsc-clean before merge. No automated test coverage added (no behavior tests exist).

## What this means for next steps
The multi-tenancy + spaces foundation is DONE and in prod. Open threads: **space_manager slice 2**
(scope global views), **Phase 2** (domains/billing/white-label — deferred, needs 2 decisions), and the
**4 un-started roadmap items** (i18n string-list, tech support, payments, certificates). Staging is a
weak test bed (OQ-008) — the catch-up was applied but the finish block may be pending. Verification of
authed admin flows was NOT possible from here (no creds) — operator must click-test on prod.
