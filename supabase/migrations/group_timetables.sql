-- GROUP-SCOPED TIMETABLES (ADR-0005, Model B)
--
-- ⚠ DO NOT APPLY YET — this schema has NO UI reading it.
--
-- The creator's tick control, the moderator's override screen, and the learner's
-- resolved view are not built. Applying this now would add columns, a table and a
-- function that nothing calls: dead schema in production, and exactly the
-- IMPL-not-WIRED trap the standing rules name as the most expensive recurring
-- failure. Apply it in the same change as the UI that reads it.
--
-- Depends on timetable_import.sql (source_key), which IS wired and safe to apply.
--
-- Design, decided in ADR-0005:
--   One shared base agenda owned by the course creator. A group moderator may adjust
--   only the slots the creator has explicitly ticked, and only for the group they
--   moderate. A creator's edit to an un-overridden slot still reaches every group —
--   the property that ruled out copy-per-group.
--
-- Resolution for a learner in group G:
--   base rows WHERE group_id IS NULL OR group_id = G
--   LEFT JOIN overrides for G -> drop hidden, else COALESCE(override.field, base.field)
-- A learner in no group sees the shared base only.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Base entries gain the tick and group scoping

ALTER TABLE timetable_entries
  -- The tick. Default-deny: a slot is NOT adjustable until the creator says so.
  ADD COLUMN IF NOT EXISTS moderator_adjustable boolean NOT NULL DEFAULT false,
  -- NULL = shared base row. Non-null = a group-only addition owned by that
  -- group's moderator (not an override of anything).
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES course_groups(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS timetable_entries_group_idx
  ON timetable_entries(group_id) WHERE group_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Per-group overrides
--
-- A NULL patch column means "inherit the base". hidden = true drops the slot for
-- that group. One row per (entry, group).

CREATE TABLE IF NOT EXISTS timetable_entry_overrides (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id      uuid NOT NULL REFERENCES timetable_entries(id) ON DELETE CASCADE,
  group_id      uuid NOT NULL REFERENCES course_groups(id) ON DELETE CASCADE,
  title         text,
  start_time    time,
  end_time      time,
  location      text,
  location_type text CHECK (location_type IN ('online', 'in_person')),
  description   text,
  hidden        boolean NOT NULL DEFAULT false,
  updated_by    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entry_id, group_id)
);

CREATE INDEX IF NOT EXISTS timetable_entry_overrides_group_idx
  ON timetable_entry_overrides(group_id);

ALTER TABLE timetable_entry_overrides ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RLS
--
-- Real enforcement for these paths is in the API route (assertCourseOwner + the
-- service-role client), per ADR-0003. These policies are defence in depth, and are
-- INERT today regardless — see OQ-003: every policy resolving a role through
-- `profiles` recurses (42P17), because staging-setup.sql:452 defines a policy ON
-- profiles that SELECTs FROM profiles. The moderator policy below is deliberately
-- written WITHOUT touching profiles, so it is correct both now and after OQ-003.

DROP POLICY IF EXISTS "Moderators manage their group overrides" ON timetable_entry_overrides;
CREATE POLICY "Moderators manage their group overrides" ON timetable_entry_overrides
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM course_groups g
      WHERE g.id = timetable_entry_overrides.group_id
        AND g.moderator_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM timetable_entries e
      WHERE e.id = timetable_entry_overrides.entry_id
        AND e.moderator_adjustable = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM course_groups g
      WHERE g.id = timetable_entry_overrides.group_id
        AND g.moderator_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM timetable_entries e
      WHERE e.id = timetable_entry_overrides.entry_id
        AND e.moderator_adjustable = true
    )
  );

DROP POLICY IF EXISTS "Learners read their group overrides" ON timetable_entry_overrides;
CREATE POLICY "Learners read their group overrides" ON timetable_entry_overrides
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM course_group_members m
      WHERE m.group_id = timetable_entry_overrides.group_id
        AND m.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Resolved agenda for one learner
--
-- Intended for BOTH the learner timetable page and the daily cron, so a learner's
-- email cannot contradict their screen.
--
-- SECURITY INVOKER (default). Called by server code with the service-role key,
-- which already bypasses RLS, so DEFINER would buy nothing and would risk leaking
-- another group's agenda if ever granted more widely.
--
-- Times are Armenia wall-clock throughout and are never converted — see the
-- timezone contract in lib/timetable/parse-agenda-sheet.ts.

CREATE OR REPLACE FUNCTION resolved_timetable(p_course_id uuid, p_user_id uuid)
RETURNS TABLE (
  entry_id      uuid,
  date          date,
  start_time    time,
  end_time      time,
  title         text,
  location      text,
  location_type text,
  description   text,
  is_adjusted   boolean,
  group_id      uuid
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH my_group AS (
    SELECT m.group_id
    FROM course_group_members m
    JOIN course_groups g ON g.id = m.group_id
    WHERE m.user_id = p_user_id AND g.course_id = p_course_id
    LIMIT 1
  )
  SELECT
    e.id,
    e.date,
    COALESCE(o.start_time, e.start_time),
    COALESCE(o.end_time, e.end_time),
    COALESCE(o.title, e.title),
    COALESCE(o.location, e.location),
    COALESCE(o.location_type, e.location_type),
    COALESCE(o.description, e.description),
    (o.id IS NOT NULL) AS is_adjusted,
    e.group_id
  FROM timetable_entries e
  LEFT JOIN timetable_entry_overrides o
    ON o.entry_id = e.id
   AND o.group_id = (SELECT group_id FROM my_group)
  WHERE e.course_id = p_course_id
    AND (e.group_id IS NULL OR e.group_id = (SELECT group_id FROM my_group))
    AND COALESCE(o.hidden, false) = false
  ORDER BY e.date, COALESCE(o.start_time, e.start_time);
$$;

REVOKE ALL ON FUNCTION resolved_timetable(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolved_timetable(uuid, uuid) TO service_role;
