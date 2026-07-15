-- TIMETABLE IMPORT SUPPORT + daily-announcement gate
--
-- Apply by hand in the Supabase SQL editor. Idempotent; safe to re-run.
-- Both columns below are WIRED — scripts/import-agenda.mjs and the daily cron read
-- them today. (The group-scoped timetable schema is a separate migration,
-- group_timetables.sql, held back until its UI exists.)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. source_key — stable identity for idempotent re-import
--
-- Overrides and any future per-entry state FK to timetable_entries.id, so an
-- importer that DELETEs+INSERTs, or that matches on a mutable field like title,
-- would silently destroy that state on every re-import. Matching on source_key
-- (sheet + cell) lets a re-import UPDATE in place instead.

ALTER TABLE timetable_entries
  ADD COLUMN IF NOT EXISTS source_key text;

CREATE UNIQUE INDEX IF NOT EXISTS timetable_entries_course_source_key_idx
  ON timetable_entries(course_id, source_key)
  WHERE source_key IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Separate "learners can SEE the schedule" from "email them about it daily"
--
-- Until now the daily cron announced to every enrolled learner of ANY course with
-- timetable_enabled — so populating a schedule and emailing about it every morning
-- were the same act. Importing 16 future days into TLA 2026 would have sent ~1,150
-- emails (16 days x 72 learners) starting the next morning, purely as a side effect
-- of loading data.
--
-- DEFAULT false, deliberately: announcing is opt-in per course. This is a behaviour
-- change for any existing timetable_enabled course (today only TLA 2026, whose
-- entries are all in the past, so nothing was announcing anyway). Turn it on from
-- the course's Timetable tab when the daily email is actually wanted.

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS timetable_daily_announcements boolean NOT NULL DEFAULT false;

-- Verify after applying:
--   SELECT source_key FROM timetable_entries LIMIT 1;               -- column exists
--   SELECT timetable_daily_announcements FROM courses LIMIT 1;      -- exists, false
