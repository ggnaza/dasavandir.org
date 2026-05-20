-- ============================================================
-- DASAVANDIR LMS — STAGING DATABASE SETUP
-- Paste this entire file into Supabase SQL Editor and run it.
-- Order matters: base schema → migrations → storage buckets
-- ============================================================


-- ============================================================
-- 1. BASE SCHEMA
-- ============================================================

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role text not null default 'learner' check (role in ('admin', 'course_creator', 'course_manager', 'learner')),
  status text not null default 'active' check (status in ('pending', 'active')),
  created_at timestamptz default now()
);

create index if not exists profiles_email_idx on profiles (email);

create or replace function handle_new_user()
returns trigger as $$
declare
  v_best_role text;
begin
  -- Pick highest-priority role from any existing profile with the same email.
  -- Priority: admin(1) > course_creator(2) > course_manager(3) > learner(4)
  select role into v_best_role
  from profiles
  where email = NEW.email
  order by
    case role
      when 'admin'          then 1
      when 'course_creator' then 2
      when 'course_manager' then 3
      else                       4
    end
  limit 1;

  insert into profiles (id, full_name, email, role, status)
  values (
    NEW.id,
    coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.email,
    coalesce(v_best_role, NEW.raw_user_meta_data->>'role', 'learner'),
    'active'
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, profiles.full_name);

  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();


create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  published boolean default false,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  language text not null default 'hy' check (language in ('en', 'hy')),
  cover_url text,
  pre_submission_ai boolean default false,
  notify_on_new_lesson boolean not null default false,
  remind_not_started_days int check (remind_not_started_days > 0),
  remind_not_completed_days int check (remind_not_completed_days > 0)
);

create table if not exists lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  title text not null,
  content text,
  video_url text,
  "order" integer default 0,
  created_at timestamptz default now(),
  deadline_days integer,
  deadline_date date,
  slide_audio_urls jsonb
);

create table if not exists lesson_files (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  created_at timestamptz default now()
);

create table if not exists quizzes (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  questions jsonb not null default '[]',
  created_at timestamptz default now(),
  use_bank boolean default false,
  bank_count integer default 5
);

create table if not exists quiz_responses (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  answers jsonb not null default '[]',
  score integer,
  submitted_at timestamptz default now()
);

create table if not exists progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  completed_at timestamptz default now(),
  unique(user_id, lesson_id)
);

create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  title text not null,
  instructions text,
  rubric jsonb not null default '[]',
  created_at timestamptz default now()
);

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  content text,
  file_path text,
  file_name text,
  link_url text,
  status text not null default 'submitted' check (status in ('submitted', 'ai_reviewed', 'approved', 'returned')),
  ai_feedback jsonb,
  ai_total_score integer,
  final_score integer,
  instructor_note text,
  final_feedback text,
  submitted_at timestamptz default now(),
  reviewed_at timestamptz
);

create table if not exists lesson_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  duration_seconds integer not null check (duration_seconds > 0),
  recorded_at timestamptz default now()
);

create table if not exists enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  enrolled_at timestamptz default now(),
  unique(user_id, course_id)
);

create table if not exists invitations (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  email text not null,
  first_name text,
  last_name text,
  invited_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique(course_id, email)
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  actor_id uuid references auth.users(id) on delete set null,
  ip text,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_actor_id_idx on audit_logs(actor_id);
create index if not exists audit_logs_action_idx on audit_logs(action);
create index if not exists audit_logs_created_at_idx on audit_logs(created_at desc);

create table if not exists capstones (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  title text not null,
  instructions text,
  rubric jsonb not null default '[]',
  created_at timestamptz default now(),
  unique(course_id)
);

create table if not exists capstone_submissions (
  id uuid primary key default gen_random_uuid(),
  capstone_id uuid not null references capstones(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  content text,
  file_path text,
  file_name text,
  link_url text,
  status text not null default 'submitted' check (status in ('submitted', 'ai_reviewed', 'approved', 'returned')),
  ai_feedback jsonb,
  ai_total_score integer,
  final_score integer,
  instructor_note text,
  final_feedback text,
  submitted_at timestamptz default now(),
  reviewed_at timestamptz,
  unique(capstone_id, user_id)
);

create table if not exists discussions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  lesson_id uuid references lessons(id) on delete set null,
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz default now()
);

create table if not exists discussion_replies (
  id uuid primary key default gen_random_uuid(),
  discussion_id uuid not null references discussions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz default now()
);

create table if not exists drive_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  tokens_json text not null,
  iv text not null,
  auth_tag text not null,
  created_at timestamptz default now(),
  expires_at timestamptz not null
);

create index if not exists drive_sessions_user_id_idx on drive_sessions(user_id);

create table if not exists activation_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  token text unique not null default gen_random_uuid()::text,
  expires_at timestamptz not null default now() + interval '24 hours',
  created_at timestamptz default now()
);

create table if not exists course_creator_access (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  granted_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique(creator_id, course_id)
);

create table if not exists course_manager_access (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  granted_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique(manager_id, course_id)
);

create table if not exists course_resources (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses(id) on delete cascade not null,
  title text not null,
  url text,
  storage_path text,
  file_name text,
  extracted_text text,
  created_at timestamptz default now() not null
);

create index if not exists course_resources_course_id_idx on course_resources(course_id);

create table if not exists course_reminder_logs (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  sent_at timestamptz not null default now(),
  unique(course_id, lesson_id, user_id, type)
);

create index if not exists course_reminder_logs_lookup_idx
  on course_reminder_logs(course_id, lesson_id, user_id);

create table if not exists lesson_reminders (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  type text not null check (type in ('new_lesson', 'not_started', 'not_completed', 'custom')),
  days_after_publish int check (days_after_publish > 0),
  send_at_date date,
  custom_subject text,
  custom_message text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists reminder_logs (
  id uuid primary key default gen_random_uuid(),
  lesson_reminder_id uuid not null references lesson_reminders(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  sent_at timestamptz not null default now(),
  unique(lesson_reminder_id, user_id)
);

create index if not exists lesson_reminders_lesson_id_idx on lesson_reminders(lesson_id);
create index if not exists reminder_logs_lesson_reminder_id_idx on reminder_logs(lesson_reminder_id);

create table if not exists ai_coach_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  summary text not null default '',
  updated_at timestamptz default now(),
  unique(user_id, course_id)
);

create table if not exists question_bank (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  question text not null,
  options jsonb not null default '[]',
  correct integer not null default 0,
  topic text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  certificate_number text unique not null,
  issued_at timestamptz default now(),
  unique(user_id, course_id)
);

create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  author_id uuid not null references profiles(id),
  title text not null,
  body text not null,
  created_at timestamptz default now()
);

create table if not exists announcement_reactions (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references announcements(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz default now(),
  unique(announcement_id, user_id, emoji)
);

create table if not exists announcement_comments (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references announcements(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz default now()
);


-- ============================================================
-- 2. ROW LEVEL SECURITY
-- ============================================================

alter table profiles enable row level security;
alter table courses enable row level security;
alter table lessons enable row level security;
alter table lesson_files enable row level security;
alter table quizzes enable row level security;
alter table quiz_responses enable row level security;
alter table progress enable row level security;
alter table assignments enable row level security;
alter table submissions enable row level security;
alter table lesson_sessions enable row level security;
alter table enrollments enable row level security;
alter table invitations enable row level security;
alter table notifications enable row level security;
alter table audit_logs enable row level security;
alter table capstones enable row level security;
alter table capstone_submissions enable row level security;
alter table discussions enable row level security;
alter table discussion_replies enable row level security;
alter table drive_sessions enable row level security;
alter table activation_tokens enable row level security;
alter table course_creator_access enable row level security;
alter table course_manager_access enable row level security;
alter table course_resources enable row level security;
alter table course_reminder_logs enable row level security;
alter table lesson_reminders enable row level security;
alter table reminder_logs enable row level security;
alter table ai_coach_memory enable row level security;
alter table question_bank enable row level security;
alter table certificates enable row level security;
alter table announcements enable row level security;
alter table announcement_reactions enable row level security;
alter table announcement_comments enable row level security;

-- Profiles
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Admins can view all profiles" on profiles for select using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Creators view their course students" on profiles for select using (exists (select 1 from course_creator_access cca join enrollments e on e.course_id = cca.course_id where cca.creator_id = auth.uid() and e.user_id = profiles.id));
create policy "Managers view assigned course students" on profiles for select using (exists (select 1 from course_manager_access cma join enrollments e on e.course_id = cma.course_id where cma.manager_id = auth.uid() and e.user_id = profiles.id));

-- Courses
create policy "Admins and creators manage courses" on courses for all using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'course_creator')));
create policy "Learners view published courses" on courses for select using (published = true);

-- Lessons
create policy "Admins manage lessons" on lessons for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "Learners view lessons" on lessons for select using (exists (select 1 from courses where id = lessons.course_id and published = true));
create policy "Staff can insert lessons" on lessons for insert to authenticated with check (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'course_creator', 'course_manager')));
create policy "Staff can update lessons" on lessons for update to authenticated using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'course_creator', 'course_manager'))) with check (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'course_creator', 'course_manager')));
create policy "Staff can delete lessons" on lessons for delete to authenticated using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'course_creator', 'course_manager')));
create policy "Staff can select lessons" on lessons for select to authenticated using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'course_creator', 'course_manager')));

-- Lesson files
create policy "Admins manage lesson files" on lesson_files for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "Learners view lesson files" on lesson_files for select using (exists (select 1 from lessons l join courses c on c.id = l.course_id where l.id = lesson_files.lesson_id and c.published = true));

-- Quizzes
create policy "Admins manage quizzes" on quizzes for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "Learners view quizzes" on quizzes for select using (exists (select 1 from lessons l join courses c on c.id = l.course_id where l.id = quizzes.lesson_id and c.published = true));

-- Quiz responses
create policy "Users manage own quiz responses" on quiz_responses for all using (auth.uid() = user_id);
create policy "Admins view all quiz responses" on quiz_responses for select using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- Progress
create policy "Users manage own progress" on progress for all using (auth.uid() = user_id);
create policy "Admins view all progress" on progress for select using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "Creators view progress in their courses" on progress for select using (exists (select 1 from course_creator_access cca join lessons l on l.id = progress.lesson_id where cca.creator_id = auth.uid() and l.course_id = cca.course_id));
create policy "Managers view progress in their courses" on progress for select using (exists (select 1 from course_manager_access cma join lessons l on l.id = progress.lesson_id where cma.manager_id = auth.uid() and l.course_id = cma.course_id));

-- Assignments
create policy "Admins manage assignments" on assignments for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "Learners view assignments" on assignments for select using (exists (select 1 from lessons l join courses c on c.id = l.course_id where l.id = assignments.lesson_id and c.published = true));

-- Submissions
create policy "Users manage own submissions" on submissions for all using (auth.uid() = user_id);
create policy "Admins manage all submissions" on submissions for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "Creators view submissions in their courses" on submissions for select using (exists (select 1 from course_creator_access cca join assignments a on a.id = submissions.assignment_id join lessons l on l.id = a.lesson_id where cca.creator_id = auth.uid() and l.course_id = cca.course_id));
create policy "Managers view submissions in their courses" on submissions for select using (exists (select 1 from course_manager_access cma join assignments a on a.id = submissions.assignment_id join lessons l on l.id = a.lesson_id where cma.manager_id = auth.uid() and l.course_id = cma.course_id));

-- Lesson sessions
create policy "Users manage own sessions" on lesson_sessions for all using (auth.uid() = user_id);
create policy "Admins view all sessions" on lesson_sessions for select using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- Enrollments
create policy "Users manage own enrollments" on enrollments for all using (auth.uid() = user_id);
create policy "Admins manage all enrollments" on enrollments for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "Creators view their course enrollments" on enrollments for select using (exists (select 1 from course_creator_access where creator_id = auth.uid() and course_id = enrollments.course_id));
create policy "Managers view their course enrollments" on enrollments for select using (exists (select 1 from course_manager_access where manager_id = auth.uid() and course_id = enrollments.course_id));

-- Invitations
create policy "Admins manage invitations" on invitations for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "Creators manage their course invitations" on invitations for all using (exists (select 1 from course_creator_access where creator_id = auth.uid() and course_id = invitations.course_id));

-- Notifications
create policy "Users manage own notifications" on notifications for all using (auth.uid() = user_id);
create policy "Admins insert notifications" on notifications for insert with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- Audit logs
create policy "Service role only" on audit_logs using (false);

-- Capstones
create policy "Admins manage capstones" on capstones for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "Enrolled users view capstones" on capstones for select using (exists (select 1 from enrollments where user_id = auth.uid() and course_id = capstones.course_id));

-- Capstone submissions
create policy "Users manage own capstone submissions" on capstone_submissions for all using (auth.uid() = user_id);
create policy "Admins manage all capstone submissions" on capstone_submissions for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- Discussions
create policy "Enrolled users view discussions" on discussions for select using (exists (select 1 from enrollments where user_id = auth.uid() and course_id = discussions.course_id) or exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "Enrolled users create discussions" on discussions for insert with check (auth.uid() = user_id and (exists (select 1 from enrollments where user_id = auth.uid() and course_id = discussions.course_id) or exists (select 1 from profiles where id = auth.uid() and role = 'admin')));
create policy "Users delete own discussions" on discussions for delete using (auth.uid() = user_id or exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- Discussion replies
create policy "Enrolled users view replies" on discussion_replies for select using (exists (select 1 from discussions d join enrollments e on e.course_id = d.course_id where d.id = discussion_replies.discussion_id and e.user_id = auth.uid()) or exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "Enrolled users create replies" on discussion_replies for insert with check (auth.uid() = user_id and (exists (select 1 from discussions d join enrollments e on e.course_id = d.course_id where d.id = discussion_replies.discussion_id and e.user_id = auth.uid()) or exists (select 1 from profiles where id = auth.uid() and role = 'admin')));
create policy "Users delete own replies" on discussion_replies for delete using (auth.uid() = user_id or exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- Drive sessions
create policy "Users manage own drive sessions" on drive_sessions for all using (auth.uid() = user_id);

-- Activation tokens
create policy "Service role only" on activation_tokens for all using (false) with check (false);

-- Course creator access
create policy "Admins manage course creator access" on course_creator_access for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "Creators view own access" on course_creator_access for select using (creator_id = auth.uid());

-- Course manager access
create policy "Admins manage course manager access" on course_manager_access for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "Managers view own access" on course_manager_access for select using (manager_id = auth.uid());
create policy "Creators manage their course moderators" on course_manager_access for all using (exists (select 1 from course_creator_access where creator_id = auth.uid() and course_id = course_manager_access.course_id));

-- Course resources
create policy "Admins and creators manage course resources" on course_resources for all using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role in ('admin', 'course_creator', 'course_manager')));
create policy "Enrolled learners can read course resources" on course_resources for select using (exists (select 1 from enrollments where enrollments.user_id = auth.uid() and enrollments.course_id = course_resources.course_id));

-- Course reminder logs
create policy "Admins view course_reminder_logs" on course_reminder_logs for select using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- Lesson reminders
create policy "Admins and creators manage lesson_reminders" on lesson_reminders for all using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'course_creator')));

-- Reminder logs
create policy "Admins view reminder_logs" on reminder_logs for select using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- AI coach memory
create policy "Users manage own ai memory" on ai_coach_memory for all using (auth.uid() = user_id);
create policy "Service role manages ai memory" on ai_coach_memory for all using (true) with check (true);

-- Question bank
create policy "Admins and creators manage question bank" on question_bank for all using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'course_creator')));
create policy "Learners can view question bank" on question_bank for select using (exists (select 1 from enrollments where user_id = auth.uid() and course_id = question_bank.course_id));

-- Certificates
create policy "Users view own certificates" on certificates for select using (auth.uid() = user_id);
create policy "Admins view all certificates" on certificates for select using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "Allow insert certificates" on certificates for insert with check (true);

-- Announcements
create policy "Admins manage all announcements" on announcements for all to authenticated using (exists (select 1 from profiles where id = auth.uid() and role = 'admin')) with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "Creators manage their course announcements" on announcements for all to authenticated using (exists (select 1 from course_creator_access where creator_id = auth.uid() and course_id = announcements.course_id)) with check (exists (select 1 from course_creator_access where creator_id = auth.uid() and course_id = announcements.course_id));
create policy "Managers manage their course announcements" on announcements for all to authenticated using (exists (select 1 from course_manager_access where manager_id = auth.uid() and course_id = announcements.course_id)) with check (exists (select 1 from course_manager_access where manager_id = auth.uid() and course_id = announcements.course_id));
create policy "Enrolled learners view announcements" on announcements for select to authenticated using (exists (select 1 from enrollments where user_id = auth.uid() and course_id = announcements.course_id));

-- Announcement reactions
create policy "Users manage own reactions" on announcement_reactions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "View reactions on accessible announcements" on announcement_reactions for select to authenticated using (exists (select 1 from announcements a where a.id = announcement_reactions.announcement_id and (exists (select 1 from enrollments where user_id = auth.uid() and course_id = a.course_id) or exists (select 1 from course_creator_access where creator_id = auth.uid() and course_id = a.course_id) or exists (select 1 from course_manager_access where manager_id = auth.uid() and course_id = a.course_id) or exists (select 1 from profiles where id = auth.uid() and role = 'admin'))));

-- Announcement comments
create policy "Users manage own comments" on announcement_comments for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "View comments on accessible announcements" on announcement_comments for select to authenticated using (exists (select 1 from announcements a where a.id = announcement_comments.announcement_id and (exists (select 1 from enrollments where user_id = auth.uid() and course_id = a.course_id) or exists (select 1 from course_creator_access where creator_id = auth.uid() and course_id = a.course_id) or exists (select 1 from course_manager_access where manager_id = auth.uid() and course_id = a.course_id) or exists (select 1 from profiles where id = auth.uid() and role = 'admin'))));


-- ============================================================
-- 3. STORAGE BUCKETS
-- Run these separately if the SQL editor doesn't support them.
-- You can also create buckets via Supabase Dashboard → Storage.
-- ============================================================

-- course-covers bucket (public)
insert into storage.buckets (id, name, public)
values ('course-covers', 'course-covers', true)
on conflict (id) do nothing;

-- lesson-files bucket (private)
insert into storage.buckets (id, name, public)
values ('lesson-files', 'lesson-files', false)
on conflict (id) do nothing;

-- course-resources bucket (private)
insert into storage.buckets (id, name, public)
values ('course-resources', 'course-resources', false)
on conflict (id) do nothing;

-- Storage policies: course-covers
create policy "Staff can upload course covers" on storage.objects for insert to authenticated with check (bucket_id = 'course-covers' and exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'course_creator', 'course_manager')));
create policy "Staff can update course covers" on storage.objects for update to authenticated using (bucket_id = 'course-covers' and exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'course_creator', 'course_manager')));
create policy "Staff can delete course covers" on storage.objects for delete to authenticated using (bucket_id = 'course-covers' and exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'course_creator', 'course_manager')));
create policy "Anyone can read course covers" on storage.objects for select to public using (bucket_id = 'course-covers');


-- ============================================================
-- 4. MAKE YOURSELF ADMIN
-- After signing up on staging, run this (replace with your user ID):
-- UPDATE profiles SET role = 'admin' WHERE email = 'your@email.com';
-- ============================================================
