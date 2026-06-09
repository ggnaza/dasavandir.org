-- Groups within a course (one moderator can own multiple groups)
CREATE TABLE IF NOT EXISTS course_groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name        text NOT NULL,
  moderator_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Members of each group (one learner per course per group, enforced at app level)
CREATE TABLE IF NOT EXISTS course_group_members (
  group_id   uuid NOT NULL REFERENCES course_groups(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  added_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

-- Add group assignment flag + template URL to assignments
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS is_group_assignment boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS template_url text;

-- Add group_id to submissions (null for individual submissions)
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES course_groups(id) ON DELETE SET NULL;

-- Disable RLS on new tables (service role used throughout)
ALTER TABLE course_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE course_group_members DISABLE ROW LEVEL SECURITY;
