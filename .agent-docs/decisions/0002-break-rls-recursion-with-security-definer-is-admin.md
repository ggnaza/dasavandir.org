---
provenance: llm-reviewed
status: accepted
template-version: 1.0.0
created: 2026-08-12
last-modified: 2026-08-13
work-unit: WU-0003
supersedes: []
superseded-by: null
related: [0001-role-to-course-access-via-three-link-tables, current-user-role-read-needs-admin-client, auth-trigger-must-swallow-errors]
tags: [rls, security, supabase, auth, recursion]
---

# ADR-0002 — Break RLS recursion with a SECURITY DEFINER `is_admin()` helper, not by rewriting the policy graph

## Context
Authenticated (browser-client) reads of `profiles`, `enrollments`,
`course_creator_access`, and `course_manager_access` raise Postgres `42P17:
infinite recursion detected in policy for relation "profiles"`. Root cause: the
live bootstrap (`supabase/staging-setup.sql:452`) defines
`"Admins can view all profiles" ON profiles USING (exists (select 1 from
profiles where id = auth.uid() and role = 'admin'))` — a policy on `profiles`
that reads `profiles` — plus three more admin policies on the access tables /
enrollments that read `profiles`, which `profiles`' own "view students"
policies read back into. The result: the entire authenticated-role RLS layer is
inert, and the app avoids it by using the service-role client for essentially
everything (documented obliquely in `group_timetables.sql` and surfaced again in
the Kaits course-publishing session, PR #261, which routed course-settings save
through a service-role API). This removes all defense-in-depth: security rests
entirely on service-role + app-level checks like `assertCourseOwner`.

## Alternatives Considered
- **Rewrite every policy that reads `profiles` (~40) to be non-recursive inline** —
  genuinely thorough (also fixes per-row subquery cost), but touching 40 policies
  by hand on a live production DB with active users maximizes the chance of a
  typo that silently changes an access decision. Rejected on blast radius.
- **Drop the recursive policies entirely and rely on service-role + app checks** —
  matches today's de-facto reality and is simplest, but permanently abandons
  defense-in-depth and leaves `profiles` with no admin-visibility policy, which
  future browser-client features would silently be denied by. Rejected: it
  encodes the workaround as the design.
- **SECURITY DEFINER `is_admin()` helper; rewrite ONLY the 4 back-edge policies** —
  chosen. A `SECURITY DEFINER` function owned by the table owner reads `profiles`
  without triggering RLS, so it cannot recurse. The boolean it returns is
  identical to the old inline subquery, so no access decision changes.

**Deciding axis:** blast radius on a live, actively-used production database — the
smallest change that provably removes the recursion while keeping every access
decision byte-identical.
**Axis check:** the 4-policy helper approach wins on exactly that axis — it is the
minimal set that breaks all cycles (the direct self-reference on `profiles` plus
the three admin back-edges the `profiles` policies transitively reach), and each
rewrite preserves the policy name, command, and boolean semantics.
**Flip-condition:** if we later want the authenticated-role RLS to be a real,
relied-upon authorization layer (not just non-erroring), we'd do the full
conversion of all inline `profiles` reads to helpers — tracked as a follow-up.

## Prior art / reference
This is the pattern Supabase's own docs prescribe for RLS recursion: wrap the
role lookup in a `SECURITY DEFINER` function with a fixed `search_path`. Confirmed
against current Supabase RLS guidance (2026).

## Decision
Add `public.is_admin()` (`SECURITY DEFINER`, `STABLE`, `SET search_path = public,
pg_temp`) and rewrite the four back-edge policies — `"Admins can view all
profiles"` (profiles), `"Admins manage all enrollments"` (enrollments), `"Admins
manage course creator access"` (cca), `"Admins manage course manager access"`
(cma) — to call it. Shipped as `supabase/migrations/fix_rls_recursion.sql`
(idempotent). Apply only AFTER the read-only verification pack confirms prod
matches this topology.

## Consequences
- Authenticated reads of the four tables stop throwing 42P17; access decisions
  are unchanged; service-role paths are unaffected (they bypass RLS either way).
- Defense-in-depth is partially restored: the policies now actually evaluate.
- The ~40 forward inline `profiles` reads still exist (correct, but per-row cost);
  a full helper conversion is deferred (OQ-007).
- A new dependency: `is_admin()` must remain `SECURITY DEFINER` with a fixed
  `search_path`; dropping it or changing ownership would reintroduce recursion or
  a search-path hazard.

## Applied (verified against live pg_policies)
- **Staging** 2026-08-13 — applied; validated in-app (admin/creator/learner logins + the
  Kaits course-settings save path). Enrollments back-edge there was named
  `"Admins manage all enrollments"` (FOR ALL).
- **Production** 2026-08-13 — verified-then-applied. **Drift found (OQ-008):** prod's
  enrollments back-edge is `"Admins view all enrollments"` (FOR SELECT), NOT the staging
  name — the staging block would have missed it; the prod block targeted the correct name.
  Prod's `handle_new_user()` **already** had the email role-inheritance (Option A), so no
  trigger change was needed on prod. Prod is also **missing** the manager-visibility
  policies (`"Managers view their course enrollments"`, `"Managers view assigned course
  students"`) that staging has — noted, not a recursion issue, tracked under OQ-008.

## Related
ADR-0001 · memories/rls-policies-recurse-through-profiles · OQ-007 · OQ-008 ·
supabase/migrations/fix_rls_recursion.sql · log.md 2026-08-13
