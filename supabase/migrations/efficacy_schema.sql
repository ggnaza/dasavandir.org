-- EFFICACY TOOL — Phase 0: schema, role, profiles tick, all tables
-- Idempotent. Paste into the Supabase SQL editor in one go.
-- Does NOT touch the handle_new_user() trigger or the role CHECK constraint.

-- ============================================================
-- 0. Separate schema + scoped database role
-- ============================================================
CREATE SCHEMA IF NOT EXISTS efficacy;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'efficacy_rw') THEN
    CREATE ROLE efficacy_rw NOLOGIN;
  END IF;
END $$;

GRANT USAGE  ON SCHEMA efficacy TO efficacy_rw;
GRANT ALL    ON ALL TABLES    IN SCHEMA efficacy TO efficacy_rw;
GRANT ALL    ON ALL SEQUENCES IN SCHEMA efficacy TO efficacy_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA efficacy
  GRANT ALL ON TABLES    TO efficacy_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA efficacy
  GRANT ALL ON SEQUENCES TO efficacy_rw;

-- Read-only bridge: efficacy code can SELECT profiles for FK / display.
GRANT SELECT ON public.profiles TO efficacy_rw;

-- ============================================================
-- 1. Add is_ldm capability tick to profiles
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_ldm boolean NOT NULL DEFAULT false;

-- ============================================================
-- 2. Lesson observations (Mongo: LessonObservation)
-- ============================================================
CREATE TABLE IF NOT EXISTS efficacy.lesson_observations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ldm_id          uuid NOT NULL REFERENCES public.profiles(id),
  teacher_id      uuid NOT NULL REFERENCES public.profiles(id),
  date            date,
  lesson_number   smallint,
  subject         text,
  grade           text,
  lesson_plan_link  text,
  recording_link    text,
  planning_rubric   jsonb DEFAULT '{}'::jsonb,
  timeline          jsonb DEFAULT '[]'::jsonb,
  teaching_rubric   jsonb DEFAULT '{}'::jsonb,
  coaching          jsonb DEFAULT '{}'::jsonb,
  overall_expectations jsonb DEFAULT '{}'::jsonb,
  grand_average     numeric(4,2),
  strengths         text,
  areas_for_growth  text,
  recommendations   text,
  sent              boolean NOT NULL DEFAULT false,
  sent_at           timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lo_ldm_id_idx
  ON efficacy.lesson_observations (ldm_id);
CREATE INDEX IF NOT EXISTS lo_teacher_id_idx
  ON efficacy.lesson_observations (teacher_id);

-- ============================================================
-- 3. Competency evaluations (Mongo: CompetencyEvaluation)
-- ============================================================
CREATE TABLE IF NOT EXISTS efficacy.competency_evaluations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluator_id    uuid NOT NULL REFERENCES public.profiles(id),
  teacher_id      uuid NOT NULL REFERENCES public.profiles(id),
  period          text,
  competencies    jsonb NOT NULL DEFAULT '[]'::jsonb,
  category_averages jsonb DEFAULT '[]'::jsonb,
  average_score   numeric(4,2),
  source          text NOT NULL DEFAULT 'manual'
                  CHECK (source IN ('manual', 'ai-chat')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ce_teacher_id_idx
  ON efficacy.competency_evaluations (teacher_id);
CREATE INDEX IF NOT EXISTS ce_evaluator_id_idx
  ON efficacy.competency_evaluations (evaluator_id);

-- ============================================================
-- 4. Teacher reflections (Mongo: TeacherReflection)
-- ============================================================
CREATE TABLE IF NOT EXISTS efficacy.teacher_reflections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id      uuid NOT NULL REFERENCES public.profiles(id),
  lesson_number   smallint,
  academic_year   text,
  subject         text,
  topic           text,
  grade           text,
  students_count  smallint,
  lesson_plan_link text,
  recording_link  text,
  successful_directions text,
  previous_goals_progress text,
  self_rubric     jsonb DEFAULT '{}'::jsonb,
  goals           jsonb DEFAULT '[]'::jsonb,
  content         text,
  input_method    text,
  ai_feedback     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tr_teacher_id_idx
  ON efficacy.teacher_reflections (teacher_id);

-- ============================================================
-- 5. AI evaluations (Mongo: AiEvaluation)
-- ============================================================
CREATE TABLE IF NOT EXISTS efficacy.ai_evaluations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id      uuid NOT NULL REFERENCES public.profiles(id),
  requested_by    uuid NOT NULL REFERENCES public.profiles(id),
  reflection_id   uuid REFERENCES efficacy.teacher_reflections(id),
  observation_id  uuid REFERENCES efficacy.lesson_observations(id),
  lesson_number   smallint,
  subject         text,
  topic           text,
  lesson_plan_link text,
  recording_link  text,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'running', 'done', 'failed')),
  stage           text,
  error           text,
  result          jsonb DEFAULT '{}'::jsonb,
  accepted        boolean NOT NULL DEFAULT false,
  accepted_by     uuid REFERENCES public.profiles(id),
  stage_updated_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ae_teacher_id_idx
  ON efficacy.ai_evaluations (teacher_id);

-- ============================================================
-- 6. LDM-teacher assignments (replaces Mongo User.assignedLdm)
-- ============================================================
CREATE TABLE IF NOT EXISTS efficacy.ldm_teacher_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ldm_id      uuid NOT NULL REFERENCES public.profiles(id),
  teacher_id  uuid NOT NULL REFERENCES public.profiles(id),
  school      text,
  region      text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ldm_id, teacher_id)
);

CREATE INDEX IF NOT EXISTS lta_ldm_id_idx
  ON efficacy.ldm_teacher_assignments (ldm_id);
CREATE INDEX IF NOT EXISTS lta_teacher_id_idx
  ON efficacy.ldm_teacher_assignments (teacher_id);

-- ============================================================
-- 7. Chat configs (Mongo: ChatConfig)
-- ============================================================
CREATE TABLE IF NOT EXISTS efficacy.chat_configs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          text NOT NULL UNIQUE
                CHECK (kind IN ('plan', 'delivery')),
  instructions  text NOT NULL DEFAULT '',
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Seed defaults so the app always has rows to read.
INSERT INTO efficacy.chat_configs (kind) VALUES ('plan'), ('delivery')
  ON CONFLICT (kind) DO NOTHING;

-- ============================================================
-- 8. Chat sessions (Mongo: ChatSession)
-- ============================================================
CREATE TABLE IF NOT EXISTS efficacy.chat_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id    uuid NOT NULL REFERENCES public.profiles(id),
  created_by    uuid NOT NULL REFERENCES public.profiles(id),
  kind          text NOT NULL CHECK (kind IN ('plan', 'delivery')),
  title         text,
  plan_link     text,
  plan_text     text,
  evaluation_id uuid REFERENCES efficacy.ai_evaluations(id),
  messages      jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cs_teacher_id_idx
  ON efficacy.chat_sessions (teacher_id);

-- ============================================================
-- 9. Knowledge sources (Mongo: KnowledgeSource)
-- ============================================================
CREATE TABLE IF NOT EXISTS efficacy.knowledge_sources (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  added_by          uuid NOT NULL REFERENCES public.profiles(id),
  purpose           text NOT NULL DEFAULT 'evaluation',
  name              text NOT NULL,
  drive_folder_link text,
  drive_folder_id   text,
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'syncing', 'ready', 'error')),
  error             text,
  files_count       int NOT NULL DEFAULT 0,
  chunks_count      int NOT NULL DEFAULT 0,
  last_synced_at    timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 10. Knowledge chunks (Mongo: KnowledgeChunk)
-- ============================================================
CREATE TABLE IF NOT EXISTS efficacy.knowledge_chunks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id     uuid REFERENCES efficacy.knowledge_sources(id) ON DELETE CASCADE,
  evaluation_id uuid REFERENCES efficacy.ai_evaluations(id),
  origin        text NOT NULL DEFAULT 'drive'
                CHECK (origin IN ('drive', 'learned', 'chat')),
  purpose       text NOT NULL DEFAULT 'evaluation'
                CHECK (purpose IN ('evaluation', 'planChat')),
  file_name     text,
  text          text NOT NULL,
  embedding     real[] DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kc_source_id_idx
  ON efficacy.knowledge_chunks (source_id);
CREATE INDEX IF NOT EXISTS kc_origin_purpose_idx
  ON efficacy.knowledge_chunks (origin, purpose);

-- ============================================================
-- 11. Manifestations (Mongo: Manifestation)
-- ============================================================
CREATE TABLE IF NOT EXISTS efficacy.manifestations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       uuid NOT NULL REFERENCES public.profiles(id),
  teacher_id      uuid NOT NULL REFERENCES public.profiles(id),
  period          text,
  text            text NOT NULL,
  competency      text NOT NULL,
  category_key    text,
  category_name   text,
  confidence      numeric(4,3),
  ai_note         text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mf_teacher_id_idx
  ON efficacy.manifestations (teacher_id);
CREATE INDEX IF NOT EXISTS mf_competency_idx
  ON efficacy.manifestations (competency);

-- ============================================================
-- 12. Usage stats (Mongo: UsageStat)
-- ============================================================
CREATE TABLE IF NOT EXISTS efficacy.usage_stats (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id),
  day             date NOT NULL,
  minutes         int NOT NULL DEFAULT 0,
  last_active_at  timestamptz,
  UNIQUE (user_id, day)
);

-- ============================================================
-- 13. Correlation view (read-only join across schemas)
-- ============================================================
CREATE OR REPLACE VIEW efficacy.correlation_scores AS
SELECT
  p.id              AS user_id,
  p.email,
  p.full_name,
  ce.period,
  ce.average_score  AS practice_score,
  ce.category_averages,
  ce.created_at     AS evaluation_date
FROM efficacy.competency_evaluations ce
JOIN public.profiles p ON p.id = ce.teacher_id;

-- ============================================================
-- 14. updated_at trigger function (shared by all efficacy tables)
-- ============================================================
CREATE OR REPLACE FUNCTION efficacy.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'lesson_observations',
    'competency_evaluations',
    'teacher_reflections',
    'ai_evaluations',
    'chat_sessions',
    'chat_configs'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_updated_at ON efficacy.%I; '
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON efficacy.%I '
      'FOR EACH ROW EXECUTE FUNCTION efficacy.set_updated_at();',
      t, t
    );
  END LOOP;
END $$;

-- ============================================================
-- 15. RLS — service-role-only for now (app uses service key)
-- ============================================================
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'lesson_observations',
    'competency_evaluations',
    'teacher_reflections',
    'ai_evaluations',
    'ldm_teacher_assignments',
    'chat_configs',
    'chat_sessions',
    'knowledge_sources',
    'knowledge_chunks',
    'manifestations',
    'usage_stats'
  ]
  LOOP
    EXECUTE format('ALTER TABLE efficacy.%I ENABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;
