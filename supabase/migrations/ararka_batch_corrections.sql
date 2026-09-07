-- Ararka: batch upload support + teacher correction tracking
-- Idempotent migration — safe to re-run

-- Batch tracking on scans
ALTER TABLE ararka.scans ADD COLUMN IF NOT EXISTS batch_id uuid;
CREATE INDEX IF NOT EXISTS idx_ararka_scans_batch ON ararka.scans(batch_id);

-- Teacher correction fields on results
ALTER TABLE ararka.results ADD COLUMN IF NOT EXISTS teacher_total numeric(4,2);
ALTER TABLE ararka.results ADD COLUMN IF NOT EXISTS teacher_items jsonb;
ALTER TABLE ararka.results ADD COLUMN IF NOT EXISTS corrected_by uuid REFERENCES public.profiles(id);
ALTER TABLE ararka.results ADD COLUMN IF NOT EXISTS corrected_at timestamptz;

-- Correction audit log — every individual question correction is tracked
CREATE TABLE IF NOT EXISTS ararka.corrections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id   uuid NOT NULL REFERENCES ararka.results(id) ON DELETE CASCADE,
  question_number int NOT NULL CHECK (question_number BETWEEN 1 AND 15),
  ai_score    numeric(4,2) NOT NULL,
  teacher_score numeric(4,2) NOT NULL,
  reason      text,
  corrected_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ararka_corrections_result ON ararka.corrections(result_id);

-- Allow scans to store teacher_name extracted from the scan
ALTER TABLE ararka.scans ADD COLUMN IF NOT EXISTS teacher_name text;

-- Grant access (same pattern as original schema)
GRANT USAGE ON SCHEMA ararka TO authenticated, anon, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA ararka TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA ararka TO authenticated, service_role;
