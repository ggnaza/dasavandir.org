-- ============================================================
-- COURSE CREATOR ACCESS CONTROL
-- Run this in Supabase → SQL Editor
-- ============================================================

-- Table linking course creators to their assigned courses
create table if not exists course_creator_access (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  granted_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique(creator_id, course_id)
);

alter table course_creator_access enable row level security;

create policy "Admins manage course creator access" on course_creator_access
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Creators view own access" on course_creator_access
  for select using (creator_id = auth.uid());

-- Course creators see only profiles of students in their assigned courses
create policy "Creators view their course students" on profiles
  for select using (
    exists (
      select 1
      from course_creator_access cca
      join enrollments e on e.course_id = cca.course_id
      where cca.creator_id = auth.uid()
        and e.user_id = profiles.id
    )
  );

-- Course creators see enrollments for their courses
create policy "Creators view their course enrollments" on enrollments
  for select using (
    exists (
      select 1 from course_creator_access
      where creator_id = auth.uid() and course_id = enrollments.course_id
    )
  );

-- Course creators see submissions in their courses
create policy "Creators view submissions in their courses" on submissions
  for select using (
    exists (
      select 1
      from course_creator_access cca
      join assignments a on a.id = submissions.assignment_id
      join lessons l on l.id = a.lesson_id
      where cca.creator_id = auth.uid() and l.course_id = cca.course_id
    )
  );

-- Course creators see progress in their courses
create policy "Creators view progress in their courses" on progress
  for select using (
    exists (
      select 1
      from course_creator_access cca
      join lessons l on l.id = progress.lesson_id
      where cca.creator_id = auth.uid() and l.course_id = cca.course_id
    )
  );
