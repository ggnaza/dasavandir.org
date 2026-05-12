# Critical invariants for this codebase

These rules exist because they have been violated and broken production. Do not violate them again without understanding what they protect against.

## Auth — DO NOT BREAK

### The `handle_new_user()` Postgres trigger
Lives in `supabase/migrations/fix_user_creation_trigger.sql`. It runs on every `auth.users` INSERT and creates the matching `profiles` row.

**Hard rules:**
1. The trigger body **must** be wrapped in `EXCEPTION WHEN OTHERS` so any failure becomes a `RAISE WARNING`, not a user-blocking error. A trigger that raises during user creation breaks BOTH email signup ("Database error saving new user") AND Google SSO (Supabase OAuth callback returns no `code`, only `error_description`).
2. The trigger **must not** read `role` from `raw_user_meta_data` — that's a privilege escalation vector (attacker sets `role=admin` in signup metadata).
3. If you change `profiles` columns, **update the trigger in the same migration**. If you add a NOT NULL column without a default, the trigger will fail.
4. After any change, run a smoke test: create a user via the Supabase dashboard. If you see "Database error saving new user", the trigger is broken — fix it before merging.

### Defensive profile upserts
Because the trigger now silently warns on failure instead of raising, app code must defensively upsert into `profiles` after any auth flow that creates an `auth.users` row. These call sites already do this:
- `app/api/auth/signup/route.ts` — after `auth.signUp`
- `app/auth/callback/route.ts` — after `exchangeCodeForSession`
- `app/api/enrollments/enroll/route.ts` — before insert (FK protection)
- `app/api/admin/users/create/route.ts` — after `auth.admin.generateLink`

Use the helper `ensureProfile(admin, user)` in `lib/auth/ensure-profile.ts` for new call sites. Do not write the upsert inline — keep it consistent.

### OAuth callback error handling
`app/auth/callback/route.ts` reads `error` and `error_description` query params from the Supabase OAuth redirect. **Do not remove this** — it's the only way users see real OAuth errors (otherwise they get "no_code").

## Migrations

- Migrations in `supabase/migrations/` are **applied manually in the Supabase SQL editor** — there is no auto-runner.
- Every new migration must be idempotent: `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS` before `ADD CONSTRAINT`, etc.
- Multiple trigger definitions across migrations have caused production outages. Before adding `CREATE OR REPLACE FUNCTION handle_new_user()`, check that you're preserving the `EXCEPTION WHEN OTHERS` handler.

## Enrollment / lesson access

- `enrollments.user_id` is FK to `profiles(id)`. If the profile is missing, the enrollment insert silently FK-violates. The enroll API now defensively upserts the profile first.
- The lesson page redirects to `/courses/{id}` if there's no enrollment row. This must remain — direct lesson-link sharing without enrollment would expose paid content.
- Sequential-learning gate (`!allow_shuffled_learning`) blocks access to a lesson if any prior lesson is incomplete. Server-side enforced in `app/learn/courses/[id]/lessons/[lessonId]/page.tsx`.

## Always do this after code changes
Per user instructions in MEMORY.md: after code changes, run `gh pr create` and `gh pr merge` automatically.
