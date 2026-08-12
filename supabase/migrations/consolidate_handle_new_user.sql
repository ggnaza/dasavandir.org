-- ============================================================
-- CANONICAL handle_new_user() — the SINGLE source of truth.
-- Run in Supabase → SQL Editor. Idempotent — safe to re-run.
--
-- WHY THIS EXISTS
--   handle_new_user() was redefined in FIVE migrations with divergent bodies
--   (fix_user_creation_trigger, fix_oauth_role_sync, production_catchup,
--   security_fixes [C-2], fix_profile_trigger). Because migrations are applied
--   by hand with no ordering guarantee, "which one is live" was unknowable and
--   two of the five violated the CLAUDE.md auth invariants:
--     • fix_profile_trigger.sql  — read role from raw_user_meta_data
--                                   (PRIVILEGE ESCALATION) and had no outer
--                                   EXCEPTION handler.
--     • security_fixes.sql [C-2] — had no outer EXCEPTION handler.
--   This file is the one authoritative definition; the others are superseded.
--
-- INVARIANTS (see CLAUDE.md § Auth):
--   1. Whole body wrapped in EXCEPTION WHEN OTHERS → a failure RAISEs a WARNING,
--      never a user-blocking error (protects BOTH email signup and Google SSO).
--   2. role is NEVER taken from raw_user_meta_data (privilege-escalation guard).
--      A new user's role is inherited only from a pre-existing profile with the
--      same email; otherwise it defaults to 'learner'.
--   3. Always sets email + status so every new signup gets a complete profile.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_best_role text;
begin
  -- Inherit the highest-priority role from any existing profile with the same
  -- email (handles Google OAuth creating a new auth user for an email that was
  -- previously created via password signup). Priority:
  --   admin(1) > course_creator(2) > course_manager(3) > learner(4)
  begin
    select role into v_best_role
    from public.profiles
    where email = NEW.email
    order by
      case role
        when 'admin'          then 1
        when 'course_creator' then 2
        when 'course_manager' then 3
        else                       4
      end
    limit 1;
  exception when others then
    v_best_role := null;
  end;

  insert into public.profiles (id, full_name, email, role, status)
  values (
    NEW.id,
    coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.email,
    coalesce(v_best_role, 'learner'),   -- NEVER raw_user_meta_data->>'role'
    'active'
  )
  on conflict (id) do update
    set email     = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name);

  return NEW;
exception when others then
  -- Any unexpected failure becomes a warning, NOT a user-blocking error.
  -- Missing profiles are backfilled defensively by ensureProfile() in app code.
  raise warning '[handle_new_user] profile insert failed for user % (%): %',
    NEW.id, NEW.email, SQLERRM;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Smoke test after applying (CLAUDE.md § Auth rule 4): create a user via the
-- Supabase dashboard. If you see "Database error saving new user", STOP — the
-- trigger is broken; do not merge.
