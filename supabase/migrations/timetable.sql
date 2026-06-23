-- TIMETABLE / SCHEDULE FEATURE
-- Course creators can enable a timetable and add daily agenda slots.
-- Each change auto-creates an announcement for enrolled learners.
-- A daily cron at 8am Armenia time (UTC+4 = 04:00 UTC) posts today's agenda.

-- Enable timetable per course
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS timetable_enabled boolean NOT NULL DEFAULT false;

-- Timetable entries
CREATE TABLE IF NOT EXISTS timetable_entries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id    uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  date         date NOT NULL,
  start_time   time NOT NULL,
  end_time     time,
  title        text NOT NULL,
  location     text NOT NULL DEFAULT 'Online',
  location_type text NOT NULL DEFAULT 'online' CHECK (location_type IN ('online', 'in_person')),
  description  text,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS timetable_entries_course_date_idx ON timetable_entries(course_id, date);

ALTER TABLE timetable_entries ENABLE ROW LEVEL SECURITY;

-- Admins: full access
CREATE POLICY "Admins manage timetable_entries" ON timetable_entries
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Course creators: manage entries for their courses
CREATE POLICY "Creators manage their timetable_entries" ON timetable_entries
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM course_creator_access WHERE creator_id = auth.uid() AND course_id = timetable_entries.course_id))
  WITH CHECK (EXISTS (SELECT 1 FROM course_creator_access WHERE creator_id = auth.uid() AND course_id = timetable_entries.course_id));

-- Course managers: manage entries for their courses
CREATE POLICY "Managers manage their timetable_entries" ON timetable_entries
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM course_manager_access WHERE manager_id = auth.uid() AND course_id = timetable_entries.course_id))
  WITH CHECK (EXISTS (SELECT 1 FROM course_manager_access WHERE manager_id = auth.uid() AND course_id = timetable_entries.course_id));

-- Enrolled learners: read only
CREATE POLICY "Enrolled learners view timetable_entries" ON timetable_entries
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM enrollments WHERE user_id = auth.uid() AND course_id = timetable_entries.course_id));
