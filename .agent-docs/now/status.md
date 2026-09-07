---
provenance: llm-reviewed
created: 2026-07-03
last-modified: 2026-09-07
tags: [current, status, modules, efficacy, gnahatum, access-control, staging]
related: [work-plan, open-questions, handoff]
---

# Status — three modules unified on staging; awaiting promotion to main · 2026-09-07

## TL;DR
Courses (LMS), Efficacy and Gnahatum (ex-Ararka) now share one deployment with one subdomain
registry, one per-module access model, and one AI key/model resolver. All operator migrations and
Vercel domain changes are applied and verified live on staging. **Nothing is on `main` yet** —
`staging` is 30 commits ahead.

## Branch
`staging` @ `b42e9d4`, in sync with `origin/staging`. 30 commits ahead of `origin/main`.

## What shipped this session (all to `staging`)
| PR | What |
|----|------|
| #326 | Module registry + subdomain routing fix, Ararka→Gnahatum rename, `module_access` per-module access, unified AI key/model resolution |
| #327 | Memory: the staging-project trap recurred; subdomain misattachment recorded |
| #328 | Grant the `efficacy` schema to `service_role` (every efficacy table was 403/42501) |
| #329 | Module-access panel portalled so the users table's `overflow-hidden` cannot clip it |

## Access model (replaces three older mechanisms)
`public.module_access(user_id, module, access)` — `access` ∈ `member` | `ldm`, one row per module a
user may enter. Superseded: `profiles.modules text[]`, the global `profiles.is_ldm` boolean, and the
implicit "course_manager/space_manager ⇒ Ararka LDM" rule. Platform admins are implicitly LDM
everywhere and hold no rows. Enforced in every module layout, entry page **and** API auth helper.
`lib/access/module-access.ts` falls back to the legacy columns on a 42P01 so a deploy that precedes
the migration cannot lock everyone out.

## Verified live on staging (2026-09-07)
- `staging.efficacy.dasavandir.org` and `staging.gnahatum.dasavandir.org` — rewrite + auth-gate ✅
- `/efficacy`, `/gnahatum`, `/ararka`→`/gnahatum` (incl. sub-paths, 308) ✅
- 11/11 efficacy tables reachable via service role ✅
- Gnahatum data intact — 16 subjects, 30 tests ✅
- Grants backfilled — 214 `courses/member`, 19 `gnahatum/ldm`, 1 `gnahatum/member` ✅

## NOT verified (no local credentials)
- Authed admin UI click-through of the per-module dropdowns
- Efficacy AI coach round-trip against the live Gemini key
Both are operator-side checks on staging.

## Names deliberately NOT renamed
Postgres schema `ararka` and storage bucket `ararka-scans` keep their old names — invisible to users,
and renaming live storage would orphan every existing object. Annotated at both call sites.

## Next step
Operator click-test on staging, then a promotion PR `staging → main` (30 commits). That also brings
up `efficacy.dasavandir.org` and `gnahatum.dasavandir.org`, which are correctly pinned to Production.
