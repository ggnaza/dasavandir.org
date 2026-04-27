-- ============================================================
-- COURSE MANAGER ROLE + ACCESS CONTROL
-- Run this in Supabase → SQL Editor
-- ============================================================

-- 1. Add course_manager to allowed roles
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('admin', 'course_creator', 'course_manager', 'learner'));

-- 2. Table linking managers to their assigned courses
create table if not exists course_manager_access (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  granted_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique(manager_id, course_id)
);

alter table course_manager_access enable row level security;

create policy "Admins manage course manager access" on course_manager_access
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Managers view own access" on course_manager_access
  for select using (manager_id = auth.uid());

-- 3. Managers can view profiles of students enrolled in their courses
create policy "Managers view assigned course students" on profiles
  for select using (
    exists (
      select 1
      from course_manager_access cma
      join enrollments e on e.course_id = cma.course_id
      where cma.manager_id = auth.uid()
        and e.user_id = profiles.id
    )
  );

-- 4. Managers can view enrollments for their courses
create policy "Managers view their course enrollments" on enrollments
  for select using (
    exists (
      select 1 from course_manager_access
      where manager_id = auth.uid() and course_id = enrollments.course_id
    )
  );

-- 5. Managers can view submissions for their courses
create policy "Managers view submissions in their courses" on submissions
  for select using (
    exists (
      select 1
      from course_manager_access cma
      join assignments a on a.id = submissions.assignment_id
      join lessons l on l.id = a.lesson_id
      where cma.manager_id = auth.uid() and l.course_id = cma.course_id
    )
  );

-- 6. Managers can view progress for their courses
create policy "Managers view progress in their courses" on progress
  for select using (
    exists (
      select 1
      from course_manager_access cma
      join lessons l on l.id = progress.lesson_id
      where cma.manager_id = auth.uid() and l.course_id = cma.course_id
    )
  );
