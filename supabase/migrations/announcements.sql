-- ============================================================
-- ANNOUNCEMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES profiles(id),
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS announcement_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(announcement_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS announcement_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_comments ENABLE ROW LEVEL SECURITY;

-- Announcements: admins full access
CREATE POLICY "Admins manage all announcements"
  ON announcements FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Announcements: course creators manage their courses
CREATE POLICY "Creators manage their course announcements"
  ON announcements FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM course_creator_access WHERE creator_id = auth.uid() AND course_id = announcements.course_id))
  WITH CHECK (EXISTS (SELECT 1 FROM course_creator_access WHERE creator_id = auth.uid() AND course_id = announcements.course_id));

-- Announcements: course managers manage their courses
CREATE POLICY "Managers manage their course announcements"
  ON announcements FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM course_manager_access WHERE manager_id = auth.uid() AND course_id = announcements.course_id))
  WITH CHECK (EXISTS (SELECT 1 FROM course_manager_access WHERE manager_id = auth.uid() AND course_id = announcements.course_id));

-- Announcements: enrolled learners read only
CREATE POLICY "Enrolled learners view announcements"
  ON announcements FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM enrollments WHERE user_id = auth.uid() AND course_id = announcements.course_id));

-- Reactions: users manage their own
CREATE POLICY "Users manage own reactions"
  ON announcement_reactions FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Reactions: read by anyone who can see the announcement
CREATE POLICY "View reactions on accessible announcements"
  ON announcement_reactions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM announcements a
      WHERE a.id = announcement_reactions.announcement_id
        AND (
          EXISTS (SELECT 1 FROM enrollments WHERE user_id = auth.uid() AND course_id = a.course_id)
          OR EXISTS (SELECT 1 FROM course_creator_access WHERE creator_id = auth.uid() AND course_id = a.course_id)
          OR EXISTS (SELECT 1 FROM course_manager_access WHERE manager_id = auth.uid() AND course_id = a.course_id)
          OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        )
    )
  );

-- Comments: users manage their own
CREATE POLICY "Users manage own comments"
  ON announcement_comments FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Comments: read by anyone who can see the announcement
CREATE POLICY "View comments on accessible announcements"
  ON announcement_comments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM announcements a
      WHERE a.id = announcement_comments.announcement_id
        AND (
          EXISTS (SELECT 1 FROM enrollments WHERE user_id = auth.uid() AND course_id = a.course_id)
          OR EXISTS (SELECT 1 FROM course_creator_access WHERE creator_id = auth.uid() AND course_id = a.course_id)
          OR EXISTS (SELECT 1 FROM course_manager_access WHERE manager_id = auth.uid() AND course_id = a.course_id)
          OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        )
    )
  );
