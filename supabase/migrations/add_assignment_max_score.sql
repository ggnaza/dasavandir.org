-- The app reads assignments.max_score in many places (gradebook, submission
-- review, learner detail, AI coach context). The column was missing in
-- production, which made those nested queries error (42703) — most visibly the
-- Submissions page showed "No submissions yet" despite pending reviews existing.
-- Nullable; scoring code already treats a missing max_score as "no max". Idempotent.
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS max_score integer;
