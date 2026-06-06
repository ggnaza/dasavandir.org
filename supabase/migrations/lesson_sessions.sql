-- ============================================================
-- lesson_sessions — tracks how long learners spend per lesson
-- Run once in Supabase → SQL Editor (idempotent)
-- ============================================================

create table if not exists public.lesson_sessions (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references profiles(id) on delete cascade,
  lesson_id       uuid        not null references lessons(id) on delete cascade,
  duration_seconds integer    not null check (duration_seconds > 0),
  created_at      timestamptz not null default now()
);

create index if not exists lesson_sessions_user_idx   on public.lesson_sessions (user_id);
create index if not exists lesson_sessions_lesson_idx on public.lesson_sessions (lesson_id);

alter table public.lesson_sessions enable row level security;

-- Learners can only see/write their own sessions
create policy if not exists "Users manage own sessions" on public.lesson_sessions
  for all using (auth.uid() = user_id);

-- Service role (admin client) can read all
create policy if not exists "Service role reads all" on public.lesson_sessions
  for select using (true);
