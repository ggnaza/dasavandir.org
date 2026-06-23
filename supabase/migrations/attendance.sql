-- ATTENDANCE TRACKING
-- Tracks per-learner attendance for timetable sessions.

CREATE TABLE IF NOT EXISTS attendance (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timetable_entry_id  uuid NOT NULL REFERENCES timetable_entries(id) ON DELETE CASCADE,
  course_id           uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id             uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status              text NOT NULL DEFAULT 'unmarked' CHECK (status IN ('on_time', 'late', 'absent', 'unmarked')),
  note                text,
  recorded_by         uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at          timestamptz DEFAULT now(),
  UNIQUE(timetable_entry_id, user_id)
);

CREATE INDEX IF NOT EXISTS attendance_entry_idx ON attendance(timetable_entry_id);
CREATE INDEX IF NOT EXISTS attendance_course_user_idx ON attendance(course_id, user_id);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Admins: full access
CREATE POLICY "Admins manage attendance" ON attendance
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Course creators: manage attendance for their courses
CREATE POLICY "Creators manage attendance" ON attendance
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM course_creator_access WHERE creator_id = auth.uid() AND course_id = attendance.course_id))
  WITH CHECK (EXISTS (SELECT 1 FROM course_creator_access WHERE creator_id = auth.uid() AND course_id = attendance.course_id));

-- Course managers: manage attendance for their courses
CREATE POLICY "Managers manage attendance" ON attendance
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM course_manager_access WHERE manager_id = auth.uid() AND course_id = attendance.course_id))
  WITH CHECK (EXISTS (SELECT 1 FROM course_manager_access WHERE manager_id = auth.uid() AND course_id = attendance.course_id));
