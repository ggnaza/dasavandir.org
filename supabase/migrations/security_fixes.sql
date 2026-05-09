-- ============================================================
-- SECURITY FIXES — Run in Supabase → SQL Editor
-- Apply all four fixes in order. Each section is idempotent.
-- ============================================================


-- ============================================================
-- FIX C-2: Profile trigger must never accept role from signup metadata
-- Attackers can set role=admin in raw_user_meta_data at signup.
-- Always hard-code 'learner' as the default; admins assign roles later.
-- ============================================================

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, full_name, role)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    'learner'   -- role is NEVER taken from signup metadata
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();


-- ============================================================
-- FIX C-5: Replace old audit_logs table with correct schema
-- The old table used (user_id, entity_type, entity_id, details).
-- The application code uses (actor_id, ip, meta) — column mismatch
-- caused silent write failures. Drop and recreate with correct columns.
-- ============================================================

drop table if exists public.audit_logs cascade;

create table public.audit_logs (
  id          uuid        primary key default gen_random_uuid(),
  action      text        not null,
  actor_id    uuid        references auth.users(id) on delete set null,
  ip          text,
  meta        jsonb,
  created_at  timestamptz not null default now()
);

create index audit_logs_actor_id_idx   on public.audit_logs (actor_id);
create index audit_logs_action_idx     on public.audit_logs (action);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);

alter table public.audit_logs enable row level security;

-- Only service-role server code can read/write audit logs
create policy "Service role only"
  on public.audit_logs
  using (false);


-- ============================================================
-- FIX H-1: Tighten progress RLS to require enrollment
-- Without this a logged-in user can write progress rows for any
-- lesson they can look up, regardless of enrollment status.
-- The API route already checks enrollment; this enforces it at DB level too.
-- ============================================================

drop policy if exists "Users manage own progress" on progress;

create policy "Users manage own progress" on progress
  for all
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from enrollments e
      join lessons l on l.course_id = e.course_id
      where e.user_id = auth.uid()
        and l.id = progress.lesson_id
    )
  );


-- ============================================================
-- FIX H-5: Add course_manager to profiles role constraint
-- course_manager is a valid role in application code but was missing
-- from the check constraint, causing UPDATE failures when assigning it.
-- ============================================================

alter table profiles
  drop constraint if exists profiles_role_check;

alter table profiles
  add constraint profiles_role_check
  check (role in ('admin', 'course_creator', 'course_manager', 'learner'));


-- ============================================================
-- OPTIONAL: Add max_attempts column to quizzes table
-- Required for M-1 (quiz attempt cap feature).
-- NULL means unlimited attempts (backward-compatible default).
-- ============================================================

alter table quizzes
  add column if not exists max_attempts integer default null;
