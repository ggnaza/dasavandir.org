---
provenance: llm-reviewed
created: 2026-07-03
last-modified: 2026-09-07
tags: [current, status, efficacy, subdomain, staging]
related: [work-plan, open-questions, handoff]
---

# Status — dasavandir.org · Efficacy tool frontend + subdomain routing shipped to staging · 2026-09-07

## TL;DR
This session ported the **Teacher Efficacy Tool** (TFA lesson observation tool) from its original
Node/Express+MongoDB stack onto the LMS stack. Phase 2 (16 frontend page/component files, ~2750 lines)
and Phase 3 (subdomain routing for `efficacy.dasavandir.org`) were built and merged to staging.
**A bug remains:** `middleware.ts:50` still has the wrong staging subdomain (`efficacy.staging…` vs
`staging.efficacy…`), so subdomain routing won't work on `staging.efficacy.dasavandir.org`.

## Branch
`fix/efficacy-subdomain-name` @ `1f14960`, 1 commit ahead of `origin/staging` (local only — PR #325
was already merged on GitHub via squash). `origin/staging` @ `6970ba4`. 26 commits ahead of `origin/main`.

## What shipped (all to `staging`)
| PR | What |
|----|------|
| #310 | Phase 2 — 16 frontend files: LDM dashboard, 6-step observation wizard, competency evaluation, behavior classification chat, teacher dashboard, reflection wizard, AI coaching chat, admin management, AI config, nav, score/stepper/rubric components |
| #311 | Phase 3 — Subdomain routing: middleware rewrites `efficacy.dasavandir.org/*` → `/efficacy/*`, CSRF cross-subdomain allowlist, auth guard for `/efficacy` paths, nav link prefix stripping |
| #325 | Fix staging subdomain name in CSRF allowlist + layout (missed middleware `isEfficacySubdomain`) |

## Known bug (live on staging)
`middleware.ts:50` — `isEfficacySubdomain()` still checks `efficacy.staging.dasavandir.org` instead of
`staging.efficacy.dasavandir.org`. The CSRF guard (line 21) and layout (line 12) were fixed in PR #325
but this occurrence was missed. **Consequence:** `staging.efficacy.dasavandir.org` requests bypass the
subdomain rewrite — visitors see the main LMS, not the efficacy tool. Must fix before testing.

## Architecture (efficacy integration)
- **Database isolation:** same Supabase project, separate `efficacy` Postgres schema, scoped `efficacy_rw` role
- **Identity:** `is_ldm` boolean on `profiles` (NOT a new role enum value)
- **Supabase client:** `lib/efficacy/db.ts` — `createClient()` with `db: { schema: "efficacy" }`, service role, typed as `any`
- **Subdomain:** Next.js middleware `NextResponse.rewrite()` maps `efficacy.dasavandir.org/*` → `/efficacy/*`
- **Auth gating:** layout checks `is_ldm` + role via `createAdminClient()` (per CLAUDE.md rules)
- **Rubric computation:** planning (flat), teaching (3 categories × 5 criteria), overall expectations (flat), grand average

## Gates
- `tsc --noEmit` — clean (with `NODE_OPTIONS=--max-old-space-size=4096 npm run build` for full build)
- Pre-existing `.next/types` errors for deleted routes (`dnd-harness`) — NOT from efficacy changes

## What this means for next steps
1. Fix the `middleware.ts:50` bug (one-line change)
2. Operator tests on `staging.efficacy.dasavandir.org`
3. On operator go: promotion PR `staging → main` (26+ commits)
