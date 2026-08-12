---
provenance: llm-reviewed
created: 2026-08-12
last-modified: 2026-08-12
related: [security-audit-2026-07-open-items]
tags: [architecture, overview, supabase, nextjs, vercel]
sources: [CLAUDE.md, AUDIT_REPORT.md]
---

# Architecture overview — dasavandir.org

**What it is:** a bilingual (Armenian-default) learning-management system. Stack: **Next.js** (app
router) on **Vercel**, data + auth on **Supabase** (Postgres + RLS). Above-average security posture per
the 2026-07 audit (rate-limited logins, CSRF protection, consistent admin role checks, RLS isolation,
security headers incl. forced HTTPS).

**Roles (four):** `admin`, `course_creator`, `course_manager`, `learner`. Course access is linked
through role-specific tables, never one shared table — see `../decisions/0001-role-to-course-access-via-three-link-tables.md`.

**Auth (fragile — read before touching):**
- A Postgres trigger `handle_new_user()` creates the `profiles` row on every `auth.users` INSERT; it
  must swallow errors or it breaks email signup AND Google SSO — see
  `../memories/auth-trigger-must-swallow-errors.md`.
- App code defensively upserts `profiles` after auth flows via `ensureProfile()`
  (`lib/auth/ensure-profile.ts`).
- Reading the current user's own role requires the service-role admin client (RLS on `profiles`) — see
  `../memories/current-user-role-read-needs-admin-client.md`.
- OAuth callback (`app/auth/callback/route.ts`) reads `error`/`error_description` — the only way users
  see real OAuth errors.

**Data / migrations:** `supabase/migrations/` (40+ files), idempotent, applied **by hand** in the
Supabase SQL editor — no auto-runner (`../memories/migrations-applied-by-hand.md`).

**Access gates (must remain):** lesson page redirects to `/courses/{id}` without an enrollment row
(prevents paid-content link sharing); sequential-learning gate blocks a lesson if a prior one is
incomplete (server-enforced in `app/learn/courses/[id]/lessons/[lessonId]/page.tsx`).

**Ship workflow:** feature branch → PR to **`staging`** (default) → test on `staging.dasavandir.org` →
PR `staging` → `main` on explicit go. GitHub repo `ggnaza/dasavandir.org`; Vercel auto-deploys.

**Last-verified:** 2026-08-12 against `CLAUDE.md` + `AUDIT_REPORT.md` (2026-07-04). Re-verify against
code before acting on any load-bearing claim.
