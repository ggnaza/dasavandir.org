-- Gnahatum: model-independent learning layer + History split into three subjects
--
-- Idempotent — safe to re-run.
--
-- DESIGN RULE, DO NOT BREAK: nothing in the knowledge tables below
-- (answer_variants, scoring_precedents) is keyed on an AI model. What the
-- system learns is stored as plain text keyed on (test_id, question_number),
-- so a model swap — Claude to Gemini, Sonnet to Opus — keeps every piece of
-- accumulated knowledge. Per-model accuracy is tracked separately in
-- benchmark_runs, which is the ONLY place a model id belongs.

-- ---------------------------------------------------------------------------
-- 1. History is three separate subjects, not one
-- ---------------------------------------------------------------------------
-- Հայաստանի պատմություն, Համաշխարհային պատմություն and Հասարակագիտություն all
-- run at grades 8 and 9. tests is UNIQUE (subject_id, grade, test_type, year),
-- so a single `history` subject cannot hold them — they collide.

INSERT INTO ararka.subjects (id, name_hy, name_en, sort_order) VALUES
  ('armenian_history', E'Հայոց պատմություն',        'Armenian History', 10),
  ('world_history',    E'Համաշխարհային պատմություն', 'World History',    11),
  ('social_studies',   E'Հասարակագիտություն',        'Social Studies',   12)
ON CONFLICT (id) DO UPDATE
  SET name_hy = EXCLUDED.name_hy,
      name_en = EXCLUDED.name_en,
      sort_order = EXCLUDED.sort_order;

-- Re-space the existing subjects around the three new ones.
UPDATE ararka.subjects SET sort_order = 13 WHERE id = 'biology';
UPDATE ararka.subjects SET sort_order = 14 WHERE id = 'chemistry';
UPDATE ararka.subjects SET sort_order = 15 WHERE id = 'physics';
UPDATE ararka.subjects SET sort_order = 16 WHERE id = 'ict';
UPDATE ararka.subjects SET sort_order = 17 WHERE id = 'phys_ed';
UPDATE ararka.subjects SET sort_order = 18 WHERE id = 'elementary_pedagogy';

-- Retire the old catch-all `history` subject, but only if nothing points at it.
DELETE FROM ararka.subjects s
 WHERE s.id = 'history'
   AND NOT EXISTS (SELECT 1 FROM ararka.tests t WHERE t.subject_id = s.id);

-- ---------------------------------------------------------------------------
-- 2. Accepted / rejected answer variants — the compounding knowledge store
-- ---------------------------------------------------------------------------
-- One row per distinct student phrasing seen at one question of one test,
-- with the verdict a human gave it. Written from teacher corrections, from the
-- hand-authored answer keys, and from the gold set. Read back at scoring time.

CREATE TABLE IF NOT EXISTS ararka.answer_variants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id         uuid NOT NULL REFERENCES ararka.tests(id) ON DELETE CASCADE,
  question_number int  NOT NULL CHECK (question_number BETWEEN 1 AND 15),
  variant_text    text NOT NULL,
  -- lowercased/whitespace-collapsed form, used only for dedupe
  normalized_text text NOT NULL,
  verdict         text NOT NULL CHECK (verdict IN ('accept', 'reject', 'partial')),
  points_awarded  numeric(4,2),
  max_points      numeric(4,2),
  times_seen      int  NOT NULL DEFAULT 1,
  source          text NOT NULL DEFAULT 'teacher_correction'
                    CHECK (source IN ('teacher_correction', 'answer_key', 'gold_set', 'manual')),
  status          text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'proposed', 'retired')),
  created_by      uuid REFERENCES public.profiles(id),
  first_seen_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (test_id, question_number, normalized_text, verdict)
);

CREATE INDEX IF NOT EXISTS idx_ararka_variants_lookup
  ON ararka.answer_variants (test_id, question_number, status);

-- Recording a variant must be atomic: two teachers correcting the same
-- question at the same time would otherwise race on a read-then-write and
-- lose one of the counts.
CREATE OR REPLACE FUNCTION ararka.record_answer_variant(
  p_test_id         uuid,
  p_question_number int,
  p_variant_text    text,
  p_verdict         text,
  p_points_awarded  numeric DEFAULT NULL,
  p_max_points      numeric DEFAULT NULL,
  p_source          text    DEFAULT 'teacher_correction',
  p_created_by      uuid    DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ararka, public, pg_temp
AS $$
DECLARE
  v_normalized text;
  v_id uuid;
BEGIN
  -- Blank or whitespace-only extractions carry no signal; skip them.
  v_normalized := lower(regexp_replace(btrim(coalesce(p_variant_text, '')), '\s+', ' ', 'g'));
  IF v_normalized = '' THEN
    RETURN NULL;
  END IF;

  INSERT INTO ararka.answer_variants (
    test_id, question_number, variant_text, normalized_text, verdict,
    points_awarded, max_points, source, created_by
  ) VALUES (
    p_test_id, p_question_number, p_variant_text, v_normalized, p_verdict,
    p_points_awarded, p_max_points, p_source, p_created_by
  )
  ON CONFLICT (test_id, question_number, normalized_text, verdict) DO UPDATE
    SET times_seen     = ararka.answer_variants.times_seen + 1,
        last_seen_at   = now(),
        points_awarded = COALESCE(EXCLUDED.points_awarded, ararka.answer_variants.points_awarded)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION ararka.record_answer_variant(
  uuid, int, text, text, numeric, numeric, text, uuid
) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Scoring precedents — rules distilled from repeated corrections
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ararka.scoring_precedents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id         uuid NOT NULL REFERENCES ararka.tests(id) ON DELETE CASCADE,
  question_number int  NOT NULL CHECK (question_number BETWEEN 1 AND 15),
  rule_text       text NOT NULL,
  evidence_count  int  NOT NULL DEFAULT 1,
  status          text NOT NULL DEFAULT 'proposed'
                    CHECK (status IN ('active', 'proposed', 'retired')),
  created_by      uuid REFERENCES public.profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (test_id, question_number, rule_text)
);

CREATE INDEX IF NOT EXISTS idx_ararka_precedents_lookup
  ON ararka.scoring_precedents (test_id, question_number, status);

-- ---------------------------------------------------------------------------
-- 4. Gold set — human-scored tests uploaded as ground truth
-- ---------------------------------------------------------------------------
-- This is the "upload 100 tests with the real scores" corpus. It is stored
-- provider-neutrally: it benchmarks any model, it mines variants, and it would
-- serve as a fine-tuning corpus if that ever becomes worthwhile.

CREATE TABLE IF NOT EXISTS ararka.gold_scans (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id       uuid NOT NULL REFERENCES ararka.tests(id) ON DELETE CASCADE,
  -- set when the gold scan came from a scan already in the system
  scan_id       uuid REFERENCES ararka.scans(id) ON DELETE SET NULL,
  file_path     text NOT NULL,
  student_label text,
  human_total   numeric(4,2) NOT NULL,
  graded_by     uuid REFERENCES public.profiles(id),
  source_note   text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ararka_gold_scans_test ON ararka.gold_scans(test_id);

CREATE TABLE IF NOT EXISTS ararka.gold_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gold_scan_id    uuid NOT NULL REFERENCES ararka.gold_scans(id) ON DELETE CASCADE,
  question_number int  NOT NULL CHECK (question_number BETWEEN 1 AND 15),
  human_points    numeric(4,2) NOT NULL,
  human_answer_text text,
  note            text,
  UNIQUE (gold_scan_id, question_number)
);

-- ---------------------------------------------------------------------------
-- 5. Benchmark runs — the ONLY table that knows about models
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ararka.benchmark_runs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_batch      uuid NOT NULL,
  model_id       text NOT NULL,
  model_provider text,
  gold_scan_id   uuid NOT NULL REFERENCES ararka.gold_scans(id) ON DELETE CASCADE,
  ai_total       numeric(4,2),
  ai_items       jsonb NOT NULL DEFAULT '[]'::jsonb,
  human_total    numeric(4,2) NOT NULL,
  abs_delta      numeric(4,2) GENERATED ALWAYS AS (abs(ai_total - human_total)) STORED,
  items_matched  int,
  items_total    int,
  -- Whether the learned-knowledge block was injected for this run. A clean
  -- model-vs-model comparison runs with it OFF: knowledge mined from the same
  -- gold scans would otherwise leak the answers back into the measurement.
  used_learning  boolean NOT NULL DEFAULT false,
  error_text     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_batch, gold_scan_id)
);

CREATE INDEX IF NOT EXISTS idx_ararka_benchmark_model ON ararka.benchmark_runs(model_id);

-- Always-current per-model rollup. A view rather than a table so it cannot
-- drift from the runs it summarises.
CREATE OR REPLACE VIEW ararka.model_performance AS
SELECT
  b.model_id,
  b.model_provider,
  b.used_learning,
  count(*)                                       AS scans_scored,
  round(avg(b.abs_delta), 3)                     AS mean_abs_delta,
  round(max(b.abs_delta), 2)                     AS worst_abs_delta,
  sum(b.items_matched)                           AS items_matched,
  sum(b.items_total)                             AS items_total,
  CASE WHEN sum(b.items_total) > 0
       THEN round(100.0 * sum(b.items_matched) / sum(b.items_total), 1)
       ELSE NULL END                             AS item_accuracy_pct,
  max(b.created_at)                              AS last_run_at
FROM ararka.benchmark_runs b
WHERE b.error_text IS NULL
GROUP BY b.model_id, b.model_provider, b.used_learning;

-- ---------------------------------------------------------------------------
-- 6. Grants (same pattern as the rest of the ararka schema)
-- ---------------------------------------------------------------------------

GRANT USAGE ON SCHEMA ararka TO authenticated, anon, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA ararka TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA ararka TO authenticated, service_role;
