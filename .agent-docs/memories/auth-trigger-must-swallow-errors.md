---
provenance: llm-reviewed
template-version: 1.0.0
created: 2026-08-12
last-modified: 2026-08-12
related: [current-user-role-read-needs-admin-client, migrations-applied-by-hand]
tags: [auth, supabase, postgres, trigger, production-outage]
---

# The `handle_new_user()` Postgres trigger must wrap its body in `EXCEPTION WHEN OTHERS` or it breaks BOTH email signup and Google SSO

**Observed:** `supabase/migrations/fix_user_creation_trigger.sql`. The trigger runs on every
`auth.users` INSERT and creates the matching `profiles` row. When its body raises (e.g. a new NOT NULL
`profiles` column with no default), email signup fails with "Database error saving new user" AND Google
SSO breaks (the OAuth callback returns no `code`, only `error_description`). Both auth paths go down at
once. This has happened in production.

**Root cause:** a trigger that raises during user creation aborts the `auth.users` INSERT. Because both
signup and SSO depend on that INSERT, one broken trigger takes out every way to create an account.

**Workaround / fix:** the trigger body MUST be wrapped so any failure becomes a `RAISE WARNING`, not a
user-blocking error. If you change `profiles` columns, update the trigger in the SAME migration. Smoke
test after any change: create a user via the Supabase dashboard — "Database error saving new user"
means it's broken; fix before merging. Because the trigger now only warns, app code defensively
upserts into `profiles` after any auth flow (`ensureProfile()` in `lib/auth/ensure-profile.ts`).

**Avoid:** never read `role` from `raw_user_meta_data` in the trigger (privilege-escalation vector — an
attacker sets `role=admin` in signup metadata). Never add a NOT NULL column without a default without
updating the trigger. Never drop the `EXCEPTION WHEN OTHERS` handler when doing
`CREATE OR REPLACE FUNCTION handle_new_user()`.

**See also:** `CLAUDE.md` §Auth — DO NOT BREAK; `supabase/migrations/fix_user_creation_trigger.sql`;
`lib/auth/ensure-profile.ts`.
