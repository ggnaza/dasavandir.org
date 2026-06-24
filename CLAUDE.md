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

## Role-to-course linking — DO NOT BREAK

There are three separate tables that link users to courses. Using the wrong one silently breaks visibility for that role. The rule is strict:

| Role | Link table | Unique key |
|------|-----------|-----------|
| `course_creator` | `course_creator_access` (`creator_id`, `course_id`) | `creator_id,course_id` |
| `course_manager` | `course_manager_access` (`manager_id`, `course_id`) | `manager_id,course_id` |
| `learner` | `enrollments` (`user_id`, `course_id`) | `user_id,course_id` |

**Hard rules:**
1. Any code path that creates or updates a user and accepts a `courseId` **must branch on role** and insert into the correct table. Never fall a `course_creator` or `course_manager` into `enrollments`. The bug was in `app/api/admin/users/create/route.ts` — it was fixed; don't reintroduce it.
2. The role toggle in `app/admin/users/user-role-toggle.tsx` must list all four roles: `admin`, `course_creator`, `course_manager`, `learner`. Removing any makes that role unassignable via the UI without any error.
3. The users page (`app/admin/users/page.tsx`) must show a course-management action for **both** `course_creator` (→ `AssignCoursesModal`) and `course_manager` (→ `AssignManagerCoursesModal`). If you add a role that has course access, add a matching UI action.
4. When adding a new role that implies course-level access, create its access table and the moderators/course-access API before wiring up the UI — never let the UI ship without the API backing it.

### How courses are fetched per role (`app/admin/courses/page.tsx`)
- `admin` → all courses from `courses`
- `course_manager` → courses via `course_manager_access.manager_id = user.id`
- `course_creator` (and any other role) → courses via `course_creator_access.creator_id = user.id`

If you add another editor role, add its branch here.

### The `GET /api/admin/moderators` route
Supports two modes:
- `?course_id=X` → list moderators for a course (requires course ownership)
- `?manager_id=X` → list courses for a manager (admin only)

Keep both modes working when editing this route.

## Always do this after code changes
After code changes, always run `gh pr create` and `gh pr merge` automatically.

**Default target branch is `staging`** — all PRs must use `--base staging` unless the user explicitly says "merge to main" or "push to main". Never use `--base main` by default.

The workflow is:
1. Claude makes changes → PR merges to `staging`
2. User tests on `staging.dasavandir.org`
3. User says "looks good, push to main" → Claude opens a PR from `staging` to `main` and merges it
