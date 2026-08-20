-- Multi-tenancy Phase 1 — spaces feature: space_members + courses.space_id + seed AEI spaces
-- (ADR-0004, WU-0008). Additive + idempotent. This migration alone is INVISIBLE — the catalog stays
-- unchanged until the app code filters by space. Apply to STAGING first.

-- 1. Space membership — explicit, many-to-many (a user can be in several spaces). Mirrors org_members.
create table if not exists space_members (
  space_id uuid not null references spaces(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'learner',
  created_at timestamptz not null default now(),
  primary key (space_id, user_id)
);
create index if not exists space_members_user_id_idx on space_members (user_id);

alter table space_members enable row level security;
drop policy if exists space_members_self_read on space_members;
create policy space_members_self_read on space_members
  for select to authenticated
  using (user_id = auth.uid());

-- 2. A course belongs to one space.
alter table courses add column if not exists space_id uuid references spaces(id);
create index if not exists courses_space_id_idx on courses (space_id);

-- 3. Seed AEI's three spaces (idempotent by (org_id, name)).
insert into spaces (org_id, name, ord)
select o.id, v.name, v.ord
from organizations o
cross join (values ('Learning', 1), ('HR Onboarding', 2), ('Recruitment Training', 3)) as v(name, ord)
where o.slug = 'aei'
  and not exists (select 1 from spaces s where s.org_id = o.id and s.name = v.name);

-- 4. Backfill to preserve today's behaviour: every existing AEI course and every existing AEI profile
--    goes into the default "Learning" space, so the space-scoped catalog looks exactly like today for
--    everyone. The operator then re-sorts HR / Recruitment members and courses in the admin UI.
--    (On empty staging this is a no-op; it does the real work on prod.)
update courses c
set space_id = (select s.id from spaces s
                join organizations o on o.id = s.org_id
                where o.slug = 'aei' and s.name = 'Learning')
where c.space_id is null
  and c.org_id = (select id from organizations where slug = 'aei');

insert into space_members (space_id, user_id, role)
select s.id, m.user_id, m.role
from spaces s
join organizations o on o.id = s.org_id
join org_members m on m.org_id = o.id
where o.slug = 'aei' and s.name = 'Learning'
on conflict (space_id, user_id) do nothing;
