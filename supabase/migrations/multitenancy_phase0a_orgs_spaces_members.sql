-- Multi-tenancy Phase 0a — foundation tables + AEI seed + backfill (ADR-0004, WU-0007)
-- Additive and idempotent. Creates the tenant backbone only; touches NO existing column.
-- After this: exactly one organization (AEI), every existing user a member of it → zero UX change.
-- Apply to STAGING first (Supabase SQL editor). Migrations are hand-applied (see
-- memories/migrations-applied-by-hand.md). Verify with the read-backs noted in the handover.

-- 1. Organizations — the tenant / billing / security boundary.
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  canonical_domain text,
  created_at timestamptz not null default now()
);

-- 2. Spaces — owner-named audiences WITHIN an org (e.g. Learning / HR Onboarding / Recruitment).
create table if not exists spaces (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  ord int not null default 1,
  created_at timestamptz not null default now()
);
create index if not exists spaces_org_id_idx on spaces (org_id);

-- 3. Org membership — one global identity, many orgs. Carries the role within that org.
create table if not exists org_members (
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'learner',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index if not exists org_members_user_id_idx on org_members (user_id);

-- 4. Seed AEI as organization #1 (idempotent on slug).
insert into organizations (name, slug, canonical_domain)
values ('Armenia Education Initiative', 'aei', 'dasavandir.org')
on conflict (slug) do nothing;

-- 5. Backfill: every existing profile becomes a member of AEI, carrying its current role.
insert into org_members (org_id, user_id, role)
select o.id, p.id, coalesce(p.role, 'learner')
from profiles p
cross join organizations o
where o.slug = 'aei'
on conflict (org_id, user_id) do nothing;

-- 6. RLS: enable on the new tables. The app reads these via the service-role client (which bypasses
--    RLS), so authenticated users get only a self-scoped read; nothing is writable by them here.
alter table organizations enable row level security;
alter table spaces        enable row level security;
alter table org_members   enable row level security;

drop policy if exists org_members_self_read on org_members;
create policy org_members_self_read on org_members
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists organizations_member_read on organizations;
create policy organizations_member_read on organizations
  for select to authenticated
  using (exists (
    select 1 from org_members m
    where m.org_id = organizations.id and m.user_id = auth.uid()
  ));

drop policy if exists spaces_member_read on spaces;
create policy spaces_member_read on spaces
  for select to authenticated
  using (exists (
    select 1 from org_members m
    where m.org_id = spaces.org_id and m.user_id = auth.uid()
  ));
