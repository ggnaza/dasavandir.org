-- LESSON REMINDERS
-- Stores reminder configurations set by course creators per lesson
create table if not exists lesson_reminders (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  -- 'new_lesson'   → notify all enrolled learners immediately (manual trigger)
  -- 'not_started'  → remind users with no lesson_sessions after N days
  -- 'not_completed'→ remind users with sessions but no progress after N days
  -- 'custom'       → send on a specific date or N days after publish
  type text not null check (type in ('new_lesson', 'not_started', 'not_completed', 'custom')),
  days_after_publish int check (days_after_publish > 0),
  send_at_date date,
  custom_subject text,
  custom_message text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Tracks which reminders have been sent to which users (prevents duplicate sends)
create table if not exists reminder_logs (
  id uuid primary key default gen_random_uuid(),
  lesson_reminder_id uuid not null references lesson_reminders(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  sent_at timestamptz not null default now(),
  unique(lesson_reminder_id, user_id)
);

alter table lesson_reminders enable row level security;
alter table reminder_logs enable row level security;

create policy "Admins and creators manage lesson_reminders" on lesson_reminders
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'course_creator'))
  );

create policy "Admins view reminder_logs" on reminder_logs
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create index if not exists lesson_reminders_lesson_id_idx on lesson_reminders(lesson_id);
create index if not exists reminder_logs_lesson_reminder_id_idx on reminder_logs(lesson_reminder_id);
