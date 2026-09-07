-- Ararka: Diagnostic test scoring module
-- Idempotent migration — safe to re-run

CREATE SCHEMA IF NOT EXISTS ararka;

-- Subjects
CREATE TABLE IF NOT EXISTS ararka.subjects (
  id          text PRIMARY KEY,
  name_hy     text NOT NULL,
  name_en     text NOT NULL,
  sort_order  int  NOT NULL DEFAULT 0
);

INSERT INTO ararka.subjects (id, name_hy, name_en, sort_order) VALUES
  ('math_elementary',     E'Մաթեմատիկա (տարրական)',  'Elementary Math',        1),
  ('armenian_elementary', E'Մայրենի (տարրական)',                      'Elementary Armenian',     2),
  ('algebra',             E'Հանրահաշիվ',                                                       'Algebra',                 3),
  ('geometry',            E'Երկրաչափություն',                         'Geometry',                4),
  ('armenian_lang',       E'Հայոց լեզու',                                                     'Armenian Language',        5),
  ('literature',          E'Գրականություն',                                     'Literature',              6),
  ('english',             E'Անգլերեն',                                                                   'English',                 7),
  ('russian',             E'Ռուսաց լեզու',                                               'Russian Language',         8),
  ('geography',           E'Աշխարհագրություն',                   'Geography',               9),
  ('history',             E'Պատմություն',                                                 'History',                10),
  ('biology',             E'Կենսաբանություն',                         'Biology',                11),
  ('chemistry',           E'Քիմիա',                                                                                     'Chemistry',              12),
  ('physics',             E'Ֆիզիկա',                                                                               'Physics',                13),
  ('ict',                 E'ՏՃՀԳ',                                                                                           'ICT / Digital Literacy',  14),
  ('phys_ed',             E'Ֆիզկուլտուրա',                                           'Physical Education',      15),
  ('elementary_pedagogy', E'Տարրական մանկավարժություն', 'Elementary Pedagogy', 16)
ON CONFLICT (id) DO NOTHING;

-- Tests: each test is a subject + grade + type + year
CREATE TABLE IF NOT EXISTS ararka.tests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id  text NOT NULL REFERENCES ararka.subjects(id),
  grade       int  NOT NULL CHECK (grade BETWEEN 1 AND 12),
  test_type   text NOT NULL CHECK (test_type IN ('diagnostic', 'summative')),
  year        text NOT NULL DEFAULT '2025-2026',
  total_points numeric(4,2) NOT NULL DEFAULT 15,
  answer_key  jsonb NOT NULL DEFAULT '[]'::jsonb,
  scoring_notes text,
  source_file_id text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_id, grade, test_type, year)
);

-- Scans: uploaded images of filled-in tests
CREATE TABLE IF NOT EXISTS ararka.scans (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id     uuid NOT NULL REFERENCES ararka.tests(id),
  student_name text,
  teacher_id  uuid REFERENCES public.profiles(id),
  file_path   text NOT NULL,
  file_url    text NOT NULL,
  status      text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'processing', 'scored', 'error', 'reviewed')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Results: AI-scored assessment per scan
CREATE TABLE IF NOT EXISTS ararka.results (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id       uuid NOT NULL REFERENCES ararka.scans(id) ON DELETE CASCADE,
  test_id       uuid NOT NULL REFERENCES ararka.tests(id),
  total_score   numeric(4,2),
  max_score     numeric(4,2) NOT NULL DEFAULT 15,
  items         jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_raw        jsonb,
  reviewed      boolean NOT NULL DEFAULT false,
  reviewed_by   uuid REFERENCES public.profiles(id),
  reviewed_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scan_id)
);

-- Calibration: compare AI scores to known human scores
CREATE TABLE IF NOT EXISTS ararka.calibrations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id       uuid NOT NULL REFERENCES ararka.scans(id) ON DELETE CASCADE,
  human_total   numeric(4,2) NOT NULL,
  human_items   jsonb,
  ai_total      numeric(4,2),
  ai_items      jsonb,
  delta         numeric(4,2) GENERATED ALWAYS AS (ai_total - human_total) STORED,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scan_id)
);

CREATE INDEX IF NOT EXISTS idx_ararka_scans_test    ON ararka.scans(test_id);
CREATE INDEX IF NOT EXISTS idx_ararka_scans_teacher ON ararka.scans(teacher_id);
CREATE INDEX IF NOT EXISTS idx_ararka_scans_status  ON ararka.scans(status);
CREATE INDEX IF NOT EXISTS idx_ararka_results_test  ON ararka.results(test_id);
