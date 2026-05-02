-- ============================================================
-- AUDIT LOGS TABLE
-- Run this in Supabase → SQL Editor
-- ============================================================

create table if not exists public.audit_logs (
  id          uuid        primary key default gen_random_uuid(),
  action      text        not null,
  actor_id    uuid        references auth.users(id) on delete set null,
  ip          text,
  meta        jsonb,
  created_at  timestamptz not null default now()
);

-- Indexes for common lookups
create index if not exists audit_logs_actor_id_idx  on public.audit_logs (actor_id);
create index if not exists audit_logs_action_idx    on public.audit_logs (action);
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);

-- Only the service role (server-side code) can read or write audit logs
alter table public.audit_logs enable row level security;

create policy "Service role only"
  on public.audit_logs
  using (false);
