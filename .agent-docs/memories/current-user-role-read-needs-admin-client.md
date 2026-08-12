---
provenance: llm-reviewed
template-version: 1.0.0
created: 2026-08-12
last-modified: 2026-08-12
related: [auth-trigger-must-swallow-errors]
tags: [auth, supabase, rls, roles, nav, production-bug]
---

# Server code reading the logged-in user's own role MUST use `createAdminClient()`, not the user-auth client

**Observed:** RLS is enabled on `profiles`. The only self-read path is the `"Users read own profile"`
policy (`supabase/migrations/profiles_self_read_policy.sql`). When server code read the current user's
profile/role with the user-auth `createClient()`, the read returned null and the nav silently
downgraded the user to `learner` — this made `course_creator` / `course_manager` and Google-OAuth
admins "appear as learners" (the `app/learn/layout.tsx` nav-role bug).

**Root cause:** the user-auth client is subject to RLS; if that self-read policy is ever dropped or the
read races, every `profiles` read returns null and the code falls back to the lowest role. The
service-role admin client bypasses RLS and reads the true role.

**Workaround / fix:** any server code that reads the logged-in user's own profile/role uses
`createAdminClient()` (service role). Do not switch these reads back to the user-auth client.

**Avoid:** don't "simplify" a role read to the user-auth client. Don't assume the self-read RLS policy
is always present — treat the admin client as the required path for role reads.

**See also:** `CLAUDE.md` §Reading the current user's role; `supabase/migrations/profiles_self_read_policy.sql`;
`app/learn/layout.tsx`.
