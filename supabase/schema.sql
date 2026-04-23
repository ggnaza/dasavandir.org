-- ============================================================
-- GOR LMS — Database Schema
-- Run this once in Supabase → SQL Editor
-- ============================================================

-- PROFILES (extends Supabase auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'learner' check (role in ('admin', 'learner')),
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, full_name, role)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    coalesce(new.raw_user_meta_data->>'role', 'learner')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();


-- COURSES
create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  published boolean default false,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);


-- LESSONS
create table if not exists lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  title text not null,
  content text,
  video_url text,
  "order" integer default 0,
  created_at timestamptz default now()
);


-- LESSON FILES (attachments)
create table if not exists lesson_files (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  created_at timestamptz default now()
);


-- QUIZZES (one per lesson, questions stored as JSON)
create table if not exists quizzes (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  questions jsonb not null default '[]',
  created_at timestamptz default now()
);

-- QUIZ RESPONSES
create table if not exists quiz_responses (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  answers jsonb not null default '[]',
  score integer,
  submitted_at timestamptz default now()
);


-- LESSON PROGRESS
create table if not exists progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  completed_at timestamptz default now(),
  unique(user_id, lesson_id)
);


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table profiles enable row level security;
alter table courses enable row level security;
alter table lessons enable row level security;
alter table lesson_files enable row level security;
alter table quizzes enable row level security;
alter table quiz_responses enable row level security;
alter table progress enable row level security;

-- Profiles: users see their own; admins see all
create policy "Users can view own profile" on profiles
  for select using (auth.uid() = id);

create policy "Admins can view all profiles" on profiles
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);

-- Courses: admins manage; learners see published
create policy "Admins manage courses" on courses
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Learners view published courses" on courses
  for select using (published = true);

-- Lessons: admins manage; learners see lessons of published courses
create policy "Admins manage lessons" on lessons
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Learners view lessons" on lessons
  for select using (
    exists (select 1 from courses where id = lessons.course_id and published = true)
  );

-- Lesson files
create policy "Admins manage lesson files" on lesson_files
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Learners view lesson files" on lesson_files
  for select using (
    exists (
      select 1 from lessons l
      join courses c on c.id = l.course_id
      where l.id = lesson_files.lesson_id and c.published = true
    )
  );

-- Quizzes
create policy "Admins manage quizzes" on quizzes
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Learners view quizzes" on quizzes
  for select using (
    exists (
      select 1 from lessons l
      join courses c on c.id = l.course_id
      where l.id = quizzes.lesson_id and c.published = true
    )
  );

-- Quiz responses: users manage own
create policy "Users manage own quiz responses" on quiz_responses
  for all using (auth.uid() = user_id);

create policy "Admins view all quiz responses" on quiz_responses
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Progress: users manage own
create policy "Users manage own progress" on progress
  for all using (auth.uid() = user_id);

create policy "Admins view all progress" on progress
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );


-- ============================================================
-- MAKE YOUR FIRST ADMIN
-- After signing up, run this to make yourself admin:
-- UPDATE profiles SET role = 'admin' WHERE id = '<your-user-id>';
-- Find your user ID in Supabase → Authentication → Users
-- ============================================================
