-- COURSE PHASES (ADR-0003)
--
-- A course runs in ordered phases (e.g. TLA -> Regional Orientation). Groups and
-- lessons are scoped to a phase; a learner may belong to one group per (course, phase),
-- and a moderator's submissions queue is scoped to the phase(s) they moderate.
--
-- Apply by hand in the Supabase SQL editor. Idempotent; safe to re-run.
--
-- ADDITIVE ONLY. This migration creates one table + two nullable FK columns and
-- mutates NO existing row. A course with zero phase rows behaves exactly as it did
-- before (phase_id stays NULL everywhere). Seeding a course's phases + assigning
-- existing groups to a phase is a SEPARATE, per-course operator step (see the PR /
-- handoff for the TLA-scoped seed) — deliberately not baked in here, so re-running
-- this file can never touch live TLA data.
--
-- RLS: reads/writes go through the service-role admin client in server code — the
-- app's real auth layer (see memories/rls-policies-recurse-through-profiles.md). The
-- table gets RLS enabled with no policies (default-deny for anon/authenticated;
-- service_role bypasses because rls_forced = false). Do NOT add FORCE ROW LEVEL
-- SECURITY — that would break the service-role path the whole app relies on.

-- 1. The phases of a course, ordered.
CREATE TABLE IF NOT EXISTS course_phases (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id  uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name       text NOT NULL,
  ord        int  NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, ord)
);

CREATE INDEX IF NOT EXISTS course_phases_course_idx ON course_phases(course_id);

-- 2. A lesson may belong to a phase. NULL = untagged/shared (visible to every
--    moderator). Assignments inherit their phase from their lesson.
ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS phase_id uuid REFERENCES course_phases(id) ON DELETE SET NULL;

-- 3. A group belongs to a phase. NULL = the legacy course-wide bucket.
ALTER TABLE course_groups
  ADD COLUMN IF NOT EXISTS phase_id uuid REFERENCES course_phases(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS lessons_phase_idx
  ON lessons(phase_id) WHERE phase_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS course_groups_phase_idx
  ON course_groups(phase_id) WHERE phase_id IS NOT NULL;

-- 4. RLS — enable, no policies. Service-role only (see header).
ALTER TABLE course_phases ENABLE ROW LEVEL SECURITY;
