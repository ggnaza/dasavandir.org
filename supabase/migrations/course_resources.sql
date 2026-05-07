-- Course-level supplementary learning resources for the AI coach
create table if not exists course_resources (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses(id) on delete cascade not null,
  title text not null,
  url text,                 -- Google Drive / Docs / Slides URL (if link)
  storage_path text,        -- Supabase storage path (if file upload)
  file_name text,           -- original file name (if file upload)
  extracted_text text,      -- text extracted for AI coach context
  created_at timestamptz default now() not null
);

create index if not exists course_resources_course_id_idx on course_resources(course_id);

alter table course_resources enable row level security;

create policy "Admins and creators manage course resources" on course_resources
  for all using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role in ('admin', 'course_creator', 'course_manager')
    )
  );

create policy "Enrolled learners can read course resources" on course_resources
  for select using (
    exists (
      select 1 from enrollments
      where enrollments.user_id = auth.uid()
        and enrollments.course_id = course_resources.course_id
    )
  );
