---
provenance: llm-reviewed
created: 2026-09-07
last-modified: 2026-09-07
tags: [current, handoff, session-state]
related: [status, work-plan, open-questions]
generator: /handoff
---

# Session handoff — READ FIRST (2026-09-07) · Efficacy tool frontend + subdomain routing → staging

## Project in one paragraph
`dasavandir.org` — a Next.js (App Router) + Supabase LMS, plus **Ararka** (AI test scoring) and now
**Teacher Efficacy Tool** (TFA lesson observation tool, ported from Node/Express+MongoDB). Deploy flow:
Claude opens PRs to `staging` → operator tests on `staging.dasavandir.org` / `staging.efficacy.dasavandir.org`
→ operator says "push to main" → promotion PR `staging → main`. Migrations are **hand-applied by the
operator** in the Supabase SQL editor (no auto-runner). **Read `⚠️ Anti-assumptions` before touching
anything.**

## Current state summary
This session built **Phase 2** (16 frontend pages/components, ~2750 lines) and **Phase 3** (subdomain
routing for `efficacy.dasavandir.org`) of the efficacy tool integration. Three PRs merged to staging
(#310, #311, #325). **A bug was found at handoff time:** `middleware.ts:50` still has the wrong staging
subdomain, so subdomain routing won't work on `staging.efficacy.dasavandir.org` until fixed (OQ-021).

| Area | State |
|------|-------|
| Efficacy Phase 0 (SQL schema) | ✅ committed (prior sessions); ❓ NOT confirmed applied to Supabase (OQ-022) |
| Efficacy Phase 1 (API routes) | ✅ committed (prior sessions) |
| Efficacy Phase 2 (frontend) | ✅ merged to staging (#310) |
| Efficacy Phase 3 (subdomain) | ✅ merged to staging (#311, #325); ⚠️ **BUG** in middleware routing (OQ-021) |
| Efficacy Phase 4 (correlation) | ❌ deferred |
| Middleware staging subdomain fix | ❌ one-line change needed (`middleware.ts:50`) |
| Promotion `staging → main` | ❌ not started, needs explicit go |

## Important context
- **Deploy/branch contract:** default PR base is `staging`; never `--base main` without explicit
  "push to main" (CLAUDE.md).
- **Efficacy identity model:** `is_ldm` boolean on `profiles` — NOT a new role enum. Admin sees all;
  `is_ldm=true` sees LDM features; everyone else sees teacher features.
- **Efficacy DB client** (`lib/efficacy/db.ts`): uses `createClient()` with `db: { schema: "efficacy" }`
  and service-role key, typed as `any` (no generated types for the efficacy schema).
- **Subdomain routing:** middleware `NextResponse.rewrite()` maps `efficacy.dasavandir.org/*` → `/efficacy/*`.
  Auth guard extended to protect `/efficacy` paths. Nav uses `stripPrefix()` to remove `/efficacy` when
  on subdomain.
- **CSRF cross-subdomain:** `SAME_DEPLOY_HOSTS` set in middleware allows API calls between
  `efficacy.dasavandir.org` and `dasavandir.org` (same Vercel deployment).
- Existing memories still apply: `migrations-applied-by-hand`, `current-user-role-read-needs-admin-client`,
  `auth-trigger-must-swallow-errors`, `staging-shares-the-production-database`.

## ⚠️ Anti-assumptions / traps
1. **`middleware.ts` has TWO `isEfficacySubdomain()` functions — and only the layout's is correct.**
   PR #325 fixed 3 of 4 occurrences of the staging subdomain. The middleware routing function at line 50
   still says `efficacy.staging.dasavandir.org`. The CSRF guard (line 21) says the correct
   `staging.efficacy.dasavandir.org`. Symptom: `staging.efficacy.dasavandir.org` loads the main LMS
   instead of the efficacy tool. → OQ-021.

2. **The efficacy `isEfficacySubdomain()` is duplicated in TWO files** — `middleware.ts:47` and
   `app/efficacy/layout.tsx:9`. They must stay in sync. A refactor to a shared util was not done because
   middleware runs in the Edge runtime and layout in Node.

3. **`staging.dasavandir.org` reads the PRODUCTION database.** Both hosts inline `mmkmsudwtrqdzehnfctx`.
   A "staging" migration is a production migration. → `memories/staging-shares-the-production-database.md`.

4. **Efficacy Phase 0 SQL may not be applied yet.** The schema (`efficacy` Postgres schema + tables +
   `efficacy_rw` role) was committed in prior sessions but the operator applying it was not confirmed.
   Without it, every efficacy API call fails. → OQ-022.

5. **`npm run build` OOMs (SIGABRT) at default heap.** Use
   `NODE_OPTIONS="--max-old-space-size=4096" npm run build`. `tsc --noEmit` is the cheap gate.

6. **The `.next/types` errors for `dnd-harness` are pre-existing** — stale generated types for a deleted
   route. Filter with `grep -v ".next/types"` when checking tsc output.

7. **The TypeScript type for the efficacy Supabase client is `any`.** No generated types exist for the
   `efficacy` schema. `lib/efficacy/db.ts` types the client as `any` deliberately. Don't try to generate
   types from the schema until the schema is stable.

## Detour-chain
**MAIN:** port the Teacher Efficacy Tool onto the LMS stack.
1. → *Phase 2 frontend (16 files)* — built all pages and components. **Resolved** (PR #310).
2. → *Phase 3 subdomain routing* — added middleware rewrite, CSRF allowlist, auth guard. **Resolved**
   (PR #311).
3. → *User said staging subdomain is `staging.efficacy.dasavandir.org`* — fixed in layout + CSRF guard.
   **Partially resolved** (PR #325) — missed middleware routing function.
4. → *Build OOM* — fixed with `NODE_OPTIONS="--max-old-space-size=4096"`. **Resolved.**
5. → *Duplicate `const path` in middleware* — removed second declaration. **Resolved.**
6. → *TypeScript error in observation form* — changed `as Record` to `as unknown as Record`. **Resolved.**

## Immediate next steps
**1. Fix `middleware.ts:50` bug (OQ-021):**
```
middleware.ts line 50: change "efficacy.staging.dasavandir.org" to "staging.efficacy.dasavandir.org"
```
One-line edit → PR to staging → merge.

**2. Confirm efficacy schema is applied (OQ-022):**
Operator must apply the `efficacy` Postgres schema migrations in the Supabase SQL editor for
`mmkmsudwtrqdzehnfctx`. Check `supabase/migrations/efficacy_*.sql` for the files.

**3. Operator tests on `staging.efficacy.dasavandir.org`:**
Log in → role-based redirect (admin→/efficacy/admin, LDM→/efficacy/ldm, teacher→/efficacy/teacher) →
dashboards → observation wizard → competency evaluation → reflection → AI coaching.

**4. On explicit operator go:** promotion PR `staging → main` (26+ commits).

### RECIPE — build gate
```
NODE_OPTIONS="--max-old-space-size=4096" npm run build > /tmp/build.log 2>&1; echo "exit: $?"
```

## Recent decisions made
| When | Decision | Rationale / reference |
|------|----------|----------------------|
| 2026-09-07 | Efficacy tool on subdomain `efficacy.dasavandir.org` | Operator chose subdomain over path; Vercel domains configured by operator |
| 2026-09-07 | Staging subdomain: `staging.efficacy.dasavandir.org` | Operator created this format (not `efficacy.staging.dasavandir.org`) |
| 2026-09-07 | `is_ldm` boolean on profiles, not a new role enum | Avoids changing the role system; efficacy access is a capability, not a role |
| 2026-09-07 | Efficacy DB in separate `efficacy` Postgres schema | Isolation from LMS tables; shared identity via `profiles` |

## Breadcrumbs / artifacts
- **No scratch artifacts from this session.** All work is in git (PRs #310, #311, #325).
- **Stash entries exist** (`git stash list`): `stash@{0}` = agent-docs WIP on staging,
  `stash@{1}` = agent-docs WIP before efficacy phase 2. These may contain prior session's agent-docs
  state — inspect before popping.

## Reading order
1. This file.
2. `now/status.md` — what shipped, the known bug, architecture summary.
3. `now/work-plan.md` — §Immediate next + WU-0015.
4. `now/open-questions.md` — OQ-021 (middleware bug), OQ-022 (schema not confirmed applied).
5. `memories/staging-shares-the-production-database.md` — read before any DB work.
6. `CLAUDE.md` — invariants (auth trigger, role→course link tables, migration hand-off format).
No `checkpoints/` sitrep post-dates this handoff.

## Recent commits (`staging`)
```
6970ba4 fix(efficacy): use staging.efficacy.dasavandir.org subdomain name (#325)
348e1f5 fix(ararka): use current Gemini model ids and give thinking its own budget (#324)
99aafe5 fix(ararka): honour the selected model instead of defaulting to Anthropic (#323)
a8bfe10 feat(ararka): upload scans direct to Supabase Storage, lifting the 4.5MB cap (#322)
452239a fix(ararka): surface the 4.5MB upload limit instead of "Scoring failed" (#321)
```

---
*How to refresh this file:* run `/handoff`.
