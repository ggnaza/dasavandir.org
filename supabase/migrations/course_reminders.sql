-- COURSE-LEVEL REMINDER SETTINGS
-- Adds reminder configuration columns to the courses table.
-- Reminders apply automatically to all lessons within the course.
alter table courses
  add column if not exists notify_on_new_lesson boolean not null default false,
  add column if not exists remind_not_started_days int check (remind_not_started_days > 0),
  add column if not exists remind_not_completed_days int check (remind_not_completed_days > 0);

-- Tracks which course-level reminders have been sent per user per lesson (dedup)
create table if not exists course_reminder_logs (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  sent_at timestamptz not null default now(),
  unique(course_id, lesson_id, user_id, type)
);

alter table course_reminder_logs enable row level security;

create policy "Admins view course_reminder_logs" on course_reminder_logs
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create index if not exists course_reminder_logs_lookup_idx
  on course_reminder_logs(course_id, lesson_id, user_id);
