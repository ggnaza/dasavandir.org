---
provenance: llm-reviewed
created: 2026-07-03
last-modified: 2026-07-06
tags: [current, open-questions]
related: [status, work-plan]
---

# Open questions — Gor LMS

> `OQ-NNN` is the single source. Reference by number. Resolve → move the item to "Recently resolved"
> with a closure reference (a commit / `ADR-NNNN` / log entry). Surface gaps loudly — an honest
> open-question beats a polished plan with a hidden assumption.

## Open

- **OQ-001** (🟡 blocker; surfaced 2026-06 by the video-duration feature) — Why does `GOOGLE_API_KEY`
  read as "not set" server-side even though it's set in Vercel, and which Drive URL formats fail with
  "could not extract file ID"? **Resolve:** debug Vercel env-var scoping / missing redeploy, and get a
  sample failing Drive URL from the user. Relates: WU-0003, [[project-video-duration]].
- **OQ-002** (🟡 product/policy; surfaced 2026-07 by the visibility audit) — Should the public
  `/courses` marketplace stay browsable to learners under the enrolled-only policy, or be gated?
  **Resolve:** a product call by Gor (marketplace drives self-signup vs. strict enrolled-only). Relates:
  ADR-0003, reference/course-visibility-model.

- **OQ-003** (🔴 blocker; surfaced 2026-07-15 while checking a security fix) — **Every RLS policy that
  resolves a role through `profiles` recurses infinitely, so RLS is inert platform-wide.** Verified
  against production with the public anon key:
  ```
  500  profiles       infinite recursion detected in policy for relation "profiles"
  500  courses        infinite recursion detected in policy for relation "profiles"
  500  lessons        infinite recursion detected in policy for relation "profiles"
  500  quiz_responses infinite recursion detected in policy for relation "profiles"
  500  enrollments    infinite recursion detected in policy for relation "course_creator_access"
  500  progress       infinite recursion detected in policy for relation "course_creator_access"
  ```
  **Cause:** `staging-setup.sql:452` — `create policy "Admins can view all profiles" on profiles for
  select using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))`. A policy on
  `profiles` that reads `profiles` re-triggers itself; every table whose policy checks a role through
  `profiles` inherits it.
  **Why it matters beyond reads:** the `courses` UPDATE policy
  (`add_rls_policies_for_creator_writes.sql:24`) also resolves the role via `profiles`, so any write
  through the *browser* Supabase client should fail the same way. That is the leading hypothesis for
  both bugs reported 2026-07-15 — the TLA timetable toggle never persisting (7 entries existed with
  `timetable_enabled=false`) and course-editor saves. UNVERIFIED for writes: proving it needs a real
  authenticated user session, which was not available.
  **This is also why ADR-0002 exists** (read roles with the admin client) and why ADR-0003's app-code
  enforcement is load-bearing — RLS is currently providing approximately none of the protection it
  appears to. Not a new regression; long-standing.
  **Resolve:** replace the recursive predicates with a `SECURITY DEFINER` helper (`is_admin()` /
  `has_course_access()`) that reads `profiles` with RLS bypassed, then re-point the policies at it.
  **Deliberately deferred** (operator, 2026-07-15: "remember to come back to RLS later") — this is the
  auth "DO NOT BREAK" zone per CLAUDE.md; getting it wrong breaks email signup AND Google SSO. It needs
  its own session with a create-a-user smoke test, not a footnote at the end of another one.

## Recently resolved

<!-- move resolved items here with their closure ref: -->
