-- Space managers (ADR-0005): a space_manager is "admin of a space" — sees/manages every course in
-- their space(s) + all learners/data there, and can create courses in the space. Parallels
-- course_manager_access, one level up (space instead of course). Additive + idempotent. Staging first.

create table if not exists space_manager_access (
  manager_id uuid not null references profiles(id) on delete cascade,
  space_id   uuid not null references spaces(id)   on delete cascade,
  granted_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  primary key (manager_id, space_id)
);
create index if not exists space_manager_access_space_id_idx on space_manager_access (space_id);

alter table space_manager_access enable row level security;
drop policy if exists space_manager_access_self_read on space_manager_access;
create policy space_manager_access_self_read on space_manager_access
  for select to authenticated
  using (manager_id = auth.uid());

-- Add 'space_manager' to the allowed roles (idempotent: drop + re-add the CHECK).
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('admin', 'course_creator', 'course_manager', 'space_manager', 'learner'));
