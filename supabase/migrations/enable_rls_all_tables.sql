-- Enable RLS on every custom table.
-- The service role (used by createAdminClient) bypasses RLS unconditionally,
-- so no existing server-side code is affected.
-- The anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY, public) will now get zero rows
-- on any direct REST call — default-deny with no policies = full block.

ALTER TABLE profiles                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_responses              ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements               ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications               ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_sessions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_creator_access       ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_manager_access       ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderator_cohort_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_groups               ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_group_members        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_coach_sessions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs                  ENABLE ROW LEVEL SECURITY;

-- Tables that may or may not exist yet — safe to run either way
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invitations') THEN
    EXECUTE 'ALTER TABLE invitations ENABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_coach_memory') THEN
    EXECUTE 'ALTER TABLE ai_coach_memory ENABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'capstone_submissions') THEN
    EXECUTE 'ALTER TABLE capstone_submissions ENABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'course_resources') THEN
    EXECUTE 'ALTER TABLE course_resources ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- No policies are created intentionally.
-- Service role bypasses RLS entirely — full access preserved.
-- Anon/authenticated role: default deny on all tables.
-- If you ever add Supabase Realtime subscriptions for learners, you would add
-- narrow SELECT policies here. Until then, nothing is needed.
