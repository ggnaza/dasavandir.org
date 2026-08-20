---
provenance: llm-reviewed
created: 2026-08-21
last-modified: 2026-08-21
tags: [current, handoff, session-state]
related: [status, work-plan, open-questions]
generator: /handoff
---

# Session handoff — READ FIRST (2026-08-21) · 🎯 Multi-tenancy + spaces + space_manager + learner profile ALL shipped to PROD

## Project in one paragraph
`dasavandir.org` — a Next.js (App Router) + Supabase LMS. Prod DB = `mmkmsudwtrqdzehnfctx`
(`.env.local`, real data); staging DB = `zzaiyqvlkdjiqnuluznl` (`.env.staging`, ~empty + schema-behind).
Deploy: Claude PRs to `staging` → operator tests on `staging.dasavandir.org` → "push to main" → promotion
PR `staging → main`. Migrations are **hand-applied by the operator** in the Supabase SQL editor (no
auto-runner; Claude has REST only, cannot run DDL). This session designed + shipped the whole
multi-tenancy roadmap to **production**; nothing is mid-flight.

## Current state summary
Everything below is **LIVE on `main`/prod** (verified: prod HTTP 200; schema + backfill introspected via
service-role REST). The operator applied every migration and, for the later features, pushed directly to
prod.
- **Multi-tenancy Phase 0+1** (ADR-0004): `organizations`+`spaces`+`org_members`+`space_members`; AEI =
  org #1; `org_id` on all tenant tables; space-scoped `/courses`; learner→space assignment; org/space
  write-stamping (`lib/org.ts`, `ensureProfile`). Prod backfill verified (144 users→org+Learning space;
  10 courses→org+Learning; 0 nulls).
- **Admin courses by space subtabs** + **`course_type` retired** (toggle gone, column kept).
- **`space_manager` role** (ADR-0005): `space_manager_access(manager_id, space_id)`; sees/creates/manages
  courses in their space via the shared `checkCourseAccess`. **Foundation only** — slice 2 (scope the
  GLOBAL views) deferred; their nav is Courses-only.
- **Learner profile** `/learn/profile` (name/avatar/region/LinkedIn-URL/bio/language/password); the user's
  **name in the nav links to it** (standalone tab removed).

Migrations applied to PROD this session: `multitenancy_phase0a/0b/0c/phase1`, `space_manager_access`,
`profiles_profile_fields` (all verified present via REST).

## Important context
- **Roles are now 5**: admin, course_creator, course_manager, **space_manager**, learner. CLAUDE.md
  §Role-to-course-linking updated (the row + fetch branch + the "route new admin views through
  `checkCourseAccess`" note + the slice-2 deferral). ADR-0005.
- **Doc store lives on `main` only.** Feature branches are cut off `origin/staging`, which does NOT have
  the doc commits — so `.agent-docs`/CLAUDE.md show OLD content on a feature branch. NEVER edit docs on a
  feature branch (stale base). ADR-0004/0005 + CLAUDE.md updates are on `main`.
- **Multi-tenancy design**: ADR-0004. RLS enforcement + `NOT NULL` on `org_id` deliberately DEFERRED to
  pre-Phase-2 (one org today → zero value, risks NULL-org rows vanishing). `getManagedSpaceIds`,
  `ensureOrgMembership`, `addUserToCourseSpace` in `lib/org.ts` are the seams.
- **Phase 2 deferred** (`memories/phase-2-multi-tenant-gtm-deferred.md`): domains/billing/white-label;
  needs 2 decisions — neutral base domain, who collects payment in another org's storefront.
- Gate = **`tsc --noEmit`** (no eslint/prettier configured, no active pre-commit hook). `next build`
  OOMs — full build needs `NODE_OPTIONS=--max-old-space-size=8192`.
- Standing invariants unchanged: `handle_new_user()` trigger (CLAUDE.md §Auth), read own role via
  `createAdminClient()`, migrations idempotent + hand-applied (`memories/migrations-applied-by-hand.md`).

## ⚠️ Anti-assumptions / traps
1. **Adding a role touches MORE than the obvious 3 spots.** The `space_manager` role-assign bug (prod):
   I updated the toggle, the CHECK constraint, and the create-route — but MISSED the zod enum in
   `app/api/admin/users/route.ts` (the role-UPDATE endpoint) → the toggle POST 400'd. Grep for the role
   ENUM everywhere (`z.enum([...roles...])`) AND the users-list role FILTER (`.in("role", [...])`) when
   adding a role, not just the UI + DB.
2. **staging ≠ prod schema (OQ-008).** Staging was missing 11 whole tables + ~30 columns vs prod. A
   migration guarded by `to_regclass` **silently skips** a missing table (that's why phase0c added
   `org_id` to everything on prod but skipped the 11 absent tables on staging). Verify the LIVE schema
   (REST OpenAPI `/rest/v1/`) before assuming a migration covered a table.
3. **A column-dependent page 500s if its migration hasn't run.** `/learn/profile` selects
   avatar_url/region/… — deploy the code before `profiles_profile_fields` runs and the page errors. It's
   a NEW route so nobody hits it until the nav link ships — but for column-adding features, migration
   FIRST (or same window as the ~1–2 min deploy).
4. **space_manager code is INERT until migration + assignment.** No existing user is `space_manager`, so
   the `space_manager_access` query never runs until the role is assigned — deploying code before the
   migration breaks nothing (but the role can't be assigned until the CHECK is updated).
5. **Catalog behavior change now LIVE:** private courses no longer appear in the public `/courses`
   (access_type filter). Intended (private = invite-only) but visible. Enrolled users still reach them
   via `/learn`.
6. **Scratchpad artifacts are EPHEMERAL** — the staging catch-up / finish SQL live in the session
   scratchpad (see §Breadcrumbs); they'll clear. The committed migration files are the durable source.

## Detour-chain
- **MAIN:** "read the feature-list Google Doc, see what we have/don't, prioritize" → scoped to 6 items →
  operator picked **multi-tenancy** first.
  - **→ Multi-tenancy design** (long Shopify/Joomag-model conversation; published Artifact "dasavandir
    Tenancy Flows") → **ADR-0004** → Phase 0 backbone + Phase 1 spaces → built, QA'd (data-level), shipped
    to staging then **prod** (#287/#289). ✅
  - **→ Space subtabs + retire course_type + `space_manager` role** (operator's next asks) → **ADR-0005**
    → shipped to prod (#289). ✅
    - **→ space_manager role-assign bug on prod** → hotfix (missed enum) → shipped (#291). ✅
  - **→ Learner profile page (#2)** → built + shipped to prod (#293). ✅
    - **→ name-in-nav links to profile** (operator tweak) → shipped (#295). ✅
  - **→ OQ-008 staging schema rebuild** (side-quest): assembled + operator-applied `staging_full_catchup.sql`
    (11 tables + 31 cols); **FINISH block still pending** (`scratchpad/staging_finish.sql`). Open.

## Immediate next steps
Nothing mid-flight. `main` is clean (`90041cf`). **Pick-next menu** (see `now/work-plan.md` §Immediate-next
for detail):
1. **Space_manager slice 2** — scope `/admin/submissions`, `/admin/learners`, `/admin/analytics`,
   capstones to a manager's spaces (`getManagedSpaceIds`), then re-add to the space_manager nav. Seam:
   `lib/assert-course-owner.ts` + `app/admin/courses/page.tsx` fetch-map. Most teed-up.
2. **Certificates fully (#5)** — verify ID + public URL + PDF + per-org custom-design upload.
3. **i18n string-list (#1)** — extract ~145 hardcoded components → `lib/i18n.ts` + CSV/Sheets roundtrip.
4. **Payments (#4)** — BLOCKED on operator: gateway (local VPOS/ArCa/Idram vs Stripe) + billing scope.
5. **Tech support (#3)**; **Phase 2 (WU-0009)** deferred.

**Operator to-dos (no creds here to do them):** click-test on prod (assign a space_manager + space; sort
real courses/learners into HR/Recruitment; try `/learn/profile` + avatar). Apply
`scratchpad/staging_finish.sql` to staging + re-diff. Security: rotate the leaked service-role key (OQ-001).

**Verify-a-migration recipe (VERBATIM):**
```bash
( set -a; . ./.env.local; set +a; /usr/bin/curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" ) \
  | python3 -c "import json,sys; print('col' in json.load(sys.stdin)['definitions']['TABLE']['properties'])"
```
(`/usr/bin/curl` — the bare `curl` intermittently failed as "command not found" in this shell.)

## Recent decisions made
| When | Decision | Ref |
|---|---|---|
| 2026-08-20 | Multi-tenancy = orgs + owner-named spaces, Shopify model, one identity + org_members/space_members, denormalized org_id + flat RLS; Phase 2 deferred | ADR-0004 |
| 2026-08-20 | `space_manager` = dedicated role + `space_manager_access` (not space_members.role, not org-admin); access via `checkCourseAccess` | ADR-0005 |
| 2026-08-20 | `course_type` retired — spaces categorise; no data migration | log 2026-08-20 |
| 2026-08-21 | LinkedIn profile field is URL-only (no live import) | WU-0011 |
| 2026-08-21 | Later features pushed DIRECTLY to prod (operator applies migrations) | this handoff |

## Breadcrumbs / artifacts
- **Published Artifact** "dasavandir Tenancy Flows" (claude.ai/code/artifact/002ca0e2-…) — the multi-tenancy
  flow design (console/storefront, identity/login, domains, spaces). Private to operator.
- **Scratchpad (EPHEMERAL — will clear):** `staging_full_catchup.sql` (applied to staging),
  `staging_finish.sql` (NOT yet applied — the OQ-008 closer), `staging_catchup_tables.sql`,
  `prod_multitenancy.sql`, `tenancy-flows.html`. Durable equivalents = the committed `supabase/migrations/`.
- **Asana:** the operator's real project is **"Dasavandir.org"** (gid 1214297568428160). An empty
  duplicate project (gid 1217461584269019) was created by mistake early on — never populated; delete if it
  bothers you.

## Reading order
1. This handoff → 2. `now/status.md` → 3. `now/work-plan.md` (pick-next menu + WU spine) →
4. `now/open-questions.md` (OQ-008 staging finish; OQ-001/004 security) → 5. `decisions/0004`, `0005`;
`memories/phase-2-multi-tenant-gtm-deferred.md` → 6. `CLAUDE.md` §Role-to-course-linking (now 5 roles).
No `checkpoints/` sitrep post-dates this handoff.

## Recent commits (main)
```
90041cf Merge #295 — name links to profile
637e540 Merge #294 — fix: name→profile, drop Profile tab
97ffdbc Merge #293 — learner profile page
6b16db2 Merge #291 — fix: space_manager role assignment (missed enum)
01d4c1d Merge #287 — multi-tenancy Phase 0+1 to prod
```

---
*How to refresh this file: `/handoff`.*
