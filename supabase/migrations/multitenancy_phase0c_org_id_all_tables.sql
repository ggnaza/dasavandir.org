-- Multi-tenancy Phase 0c — org_id on all remaining tenant tables (ADR-0004, WU-0007)
-- Additive, idempotent, and resilient to schema drift (OQ-008): each table is guarded by
-- to_regclass so a table absent on this DB is skipped, not an error.
-- Single-org reality: every existing row belongs to AEI, so the backfill is a flat `-> AEI` (no
-- parent-FK joins needed; correct going-forward stamping is Phase 1 app code). org_id stays NULLABLE;
-- NOT NULL + RLS enforcement are deferred to pre-Phase-2 (see ADR-0004).
-- Apply to STAGING first, then verify columns exist via the OpenAPI/REST introspection.

do $$
declare
  t   text;
  aei uuid;
  tables text[] := array[
    'lessons','enrollments','submissions','quizzes','quiz_responses','progress','assignments',
    'capstones','capstone_submissions','announcements','announcement_comments','announcement_reactions',
    'invitations','question_bank','ai_coach_sessions','ai_coach_messages','ai_coach_memory',
    'certificates','moderator_cohort_assignments','course_groups','course_group_members','course_phases',
    'course_resources','course_reminder_logs','course_creator_access','course_manager_access',
    'timetable_entries','timetable_entry_overrides','lesson_files','lesson_sessions','lesson_reminders',
    'reflections','discussions','discussion_replies','attendance','notifications','settings',
    'audit_logs','activation_tokens','drive_sessions','reminder_logs'
  ];
begin
  select id into aei from organizations where slug = 'aei';
  if aei is null then
    raise exception 'AEI organization not found — apply Phase 0a first';
  end if;

  foreach t in array tables loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table %I add column if not exists org_id uuid references organizations(id)', t);
      execute format('update %I set org_id = $1 where org_id is null', t) using aei;
      execute format('create index if not exists %I on %I (org_id)', t || '_org_id_idx', t);
    end if;
  end loop;
end $$;
