-- Assign specific learners to specific moderators within a course
CREATE TABLE IF NOT EXISTS moderator_cohort_assignments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  moderator_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(moderator_id, course_id, learner_id)
);

CREATE INDEX IF NOT EXISTS idx_mca_moderator_course ON moderator_cohort_assignments(moderator_id, course_id);
CREATE INDEX IF NOT EXISTS idx_mca_learner_course ON moderator_cohort_assignments(learner_id, course_id);

-- Allow moderators to see their own cohort announcements
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS target_moderator_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
