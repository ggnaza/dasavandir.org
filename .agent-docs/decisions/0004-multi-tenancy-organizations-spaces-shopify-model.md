---
provenance: llm-draft
status: proposed
template-version: 1.0.0
created: 2026-08-20
last-modified: 2026-08-20
work-unit: WU-0007
supersedes: []
superseded-by: null
related: [0001-role-to-course-access-via-three-link-tables, 0002-break-rls-recursion-with-security-definer-is-admin, 0003-course-phases-within-a-single-course]
tags: [architecture, multi-tenancy, organizations, spaces, rls, billing, domains]
---

# ADR-0004 — Multi-tenancy: `organizations` (tenant) + owner-named `spaces`, on the Shopify console/storefront model, with a denormalized `org_id` + flat RLS

## Context
`dasavandir.org` is today a **single-tenant** LMS: one global pool of `profiles`, `courses`,
`enrollments` — there is **no organization / tenant concept anywhere in the schema** (confirmed: zero
`org_id` / `tenant` references across `supabase/migrations/`). The operator (AEI — Armenia Education
Initiative) wants two things that both require tenancy:

1. **Internal audience separation.** AEI's own use splits across Learning, HR onboarding, and
   Recruitment training — those learners must **not be mixed** in one global pool.
2. **External customers.** Other organizations should be able to **pay to run their own LMS** on the
   platform — their courses, their learners, their branding, their bill.

Two revenue models must coexist and stack: **Case A (B2B)** an organization pays a subscription to use
the LMS; **Case B (B2C)** an individual learner pays for a course. AEI is "organization #1": it doesn't
pay Case A (it owns the platform) but earns Case B.

The operator settled the surface model by analogy to **Shopify / Joomag** (see the flow doc / artifact
"dasavandir Tenancy Flows"): a **console** you log into to author & manage (`admin.<domain>`, routed
from a central login `lms.armeniaeducationinitiative.org`), and **storefronts** where courses are
published for learners (`dasavandir.org`, or `<slug>.<neutral-base>` when there is no custom domain).
One global identity; the **domain** selects the surface, **membership + role** grants access.

The full surface is 43 app-touched tables (`profiles`, `courses`, `lessons`, `enrollments`,
`submissions`, `quizzes`, … — inventory in WU-0007). The core tables were created outside
`supabase/migrations/` (base schema — this is OQ-008, divergent schema sources of truth), so the live DB
is the authority, not the migration files.

## Alternatives Considered
- **Spaces only, no `organizations` / no `org_id`** (a plain "category" column on courses). Genuinely
  the smallest change to satisfy requirement #1 today. **Rejected** as the retrofit trap: it cannot
  isolate or bill an external customer (requirement #2), and adding real tenancy later means backfilling
  `org_id` and rewriting RLS across a *larger* table surface with live customer data. Since Phase 1
  already touches these tables to add `space_id`, adding `org_id` at the same time is a small marginal
  cost. Flip-condition: if external customers were permanently off the table, spaces-as-category would win.
- **`profiles.org_id` — one org per user** (the earlier lean). **Rejected** once the identity flow was
  worked through: the operator is simultaneously a **learner on dasavandir** and a **platform admin**,
  and the Joomag model ("from my account I can create a new agency account") means one human **owns/
  manages several orgs**. A single `org_id` cannot express that. Chosen instead: an `org_members`
  (`user_id, org_id, role`) join table — many-to-many from day one, trivial while there is one org
  (everyone → AEI), and it removes a future migration. Flip-condition: none realistic.
- **Derive `org_id` in RLS via joins** (courses→org, everything→course→org) instead of denormalizing.
  **Rejected.** This repo has already been burned by **RLS recursion** (ADR-0002, OQ-007 — policies that
  recursed through `profiles`); join-derived tenant policies re-introduce exactly that class of
  expensive/recursive policy. Chosen instead: **denormalize `org_id` onto every tenant-scoped table** so
  each policy is a **flat, non-recursive** `org_id = auth_org()` check (paired with a `SECURITY DEFINER`
  `auth_org()` helper, mirroring the `is_admin()` pattern from ADR-0002). Costs more backfill; buys
  simple, fast, recursion-proof policies.
- **Separate deployment / DB per customer** (hard isolation). **Rejected** — operationally unscalable,
  loses the shared-codebase leverage and cross-org platform reporting; RLS-scoped shared tables give
  sufficient isolation for this use case.
- **Root domain = platform marketing vs. root = a tenant.** Resolved out of the schema: `dasavandir.org`
  is a **storefront on a custom domain** (AEI's), the central login/console is `lms.aei`, and default
  tenants get `<slug>.<neutral-base>` (a `myshopify.com` equivalent — **never** nested under
  `dasavandir.org`, which is itself just one tenant's brand). This is a routing/domains concern (Phase
  2), not a data-model one. Open sub-decision: register a neutral base domain now vs. later (OQ, below).

**Deciding axis:** support both revenue cases + internal separation + external isolation, *without*
re-introducing RLS recursion and *without* a painful retrofit. The point that satisfies all of these is
**organizations + spaces + denormalized `org_id` + flat RLS**, rolled out in phases that keep today's
single-tenant behaviour byte-for-byte until we deliberately expose tenancy.

## Decision
**Introduce a two-level tenancy — `organizations` (the tenant: security + billing boundary) and
owner-named `spaces` (audiences within an org) — and roll it out in three phases, of which only 0 and 1
are built now.**

### Data model (additive, idempotent; nothing existing rewritten except backfilled `org_id`)
- `organizations (id uuid pk, name text, slug text unique, canonical_domain text null, created_at)`.
  `canonical_domain` is the single source every redirect / email link / certificate URL is built from
  (custom domain if set, else the platform subdomain).
- `org_members (org_id fk, user_id fk→profiles, role text, primary key (org_id, user_id))` — the
  many-to-many identity link; `role` reuses the existing role vocabulary
  (`admin | course_creator | course_manager | learner`).
- `spaces (id uuid pk, org_id fk, name text, ord int, created_at)` — **owner-named**; a course belongs
  to a space via `courses.space_id`.
- `org_id uuid` denormalized onto every tenant-scoped table (courses, lessons, enrollments, submissions,
  quizzes, quiz_responses, progress, assignments, capstones, announcements, invitations, … — full list
  in WU-0007), each backfilled to the AEI org.
- `auth_org()` — a `SECURITY DEFINER` helper returning the current request's org, so RLS policies are a
  flat `org_id = auth_org()` with no recursion. Tenant resolution sets the org from the hostname
  (middleware); until Phase 2 there is exactly one org, so `auth_org()` is effectively constant.

### Phase 0 — foundation (INVISIBLE; ship first, no UX change)
Create `organizations` + `org_members` + `spaces`; insert **AEI as organization #1**; backfill all
`profiles` into `org_members` (AEI) and stamp `org_id` on every tenant table (all → AEI). Add `auth_org()`
+ additive flat `org_id` RLS. Because there is exactly one org and everything backfills to it, **today's
users see no difference** — this is pure insurance so Phases 1–2 are additive, not a rebuild.

### Phase 1 — spaces (the feature wanted now; single domain, current admin)
Owner-named spaces (AEI seeds "Learning" / "HR Onboarding" / "Recruitment"). Adds `courses.space_id`
and a **`space_members (space_id, user_id, role)`** join table — space membership is **explicit and
many-to-many** (a user can be added to several spaces), mirroring `org_members`. It cannot be derived
from enrollments because a learner must be able to **browse a space's public courses before enrolling**;
this supersedes an earlier `enrollments.space_id` idea.

**Three-tier membership:** `org_members` (tenant boundary) → `space_members` (audience within a tenant,
carries a space-level role so a user can be learner in one space, moderator in another) → `enrollments`
(actual course participation).

**Visibility is two orthogonal axes, both from existing/near primitives** — no new visibility mechanism:
- `courses.space_id` decides *which* space catalog a course is in.
- `courses.access_type` (existing: `public | private | paid`) decides visibility *within* the space:
  `public`/`paid` show in the space catalog to all its members; `private` is invitation-only and hidden
  from the catalog (the onboarding / person-specific case — the app already gates non-enrolled users).

**Catalog rule:** a logged-in user sees every `public`/`paid` course in **any space they are a member
of** (union), **plus** any `private` course they were individually enrolled/invited into.

Runs **entirely inside `dasavandir.org` as it is today** — no subdomains, no console/storefront split,
no billing.

### Phase 2 — go-to-market machinery (DEFERRED — memorized, not built now)
The console/storefront **domain split**, subdomain routing + **tenant resolution middleware**, **custom
domains + cross-apex SSO token hand-off**, per-org **storefront editor** (extends the "homepage editing"
backlog item to one-per-org), **org self-signup + provisioning**, **subscription billing + coupons**
(Case A), and **white-label**. None of it is needed until the first external customer is onboarded.
Captured in `memories/phase-2-multi-tenant-gtm-deferred.md` and the flow artifact.

## Consequences
- **Good:** Phase 0+1 give the operator the spaces feature soon while laying the exact seam the external-
  customer story plugs into — Phase 2 becomes additive. Flat `org_id` RLS avoids the recursion class this
  repo has already paid for twice.
- **Good:** one identity + `org_members` means the operator's "I'm a learner *and* an admin *and* can spin
  up another agency" all work without a later identity migration.
- **Bad / watch:** Phase 0 is a **large, live-schema change** — `org_id` + backfill + RLS across ~43
  tables. It is **hand-applied by the operator, staging-first** (`memories/migrations-applied-by-hand.md`),
  idempotent, and should be split into reviewable sub-migrations, not one blob. The core tables live
  outside `supabase/migrations/` (OQ-008), so each migration must be generated against the **live DB**,
  not the repo files.
- **Bad / watch:** every new tenant-scoped table from now on **must** carry `org_id` + a flat RLS policy,
  or it silently leaks across tenants once Phase 2 lands. This becomes a standing invariant (to be added
  to `CLAUDE.md` when Phase 0 ships).
- **Bad / watch:** denormalized `org_id` can drift from the parent's `org_id` if an app path sets one and
  not the other; writes must stamp `org_id` from the parent, and a periodic consistency check is worth
  adding.

## Related
`CLAUDE.md` §Role-to-course linking + §Migrations; ADR-0001 (link-table role model — unchanged, now
org-scoped); ADR-0002 (`is_admin()` security-definer pattern that `auth_org()` mirrors); OQ-008 (schema
sources of truth); the flow artifact "dasavandir Tenancy Flows";
`memories/phase-2-multi-tenant-gtm-deferred.md`; WU-0007 (Phase 0), WU-0008 (Phase 1).
