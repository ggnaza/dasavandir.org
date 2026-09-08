-- Record why a scan failed.
--
-- `ararka.scans.status` could already be 'error', but the reason was thrown
-- away: the scoring route caught the exception, set the status and returned the
-- message to the caller only. Once the browser tab was closed there was no way
-- to find out what had happened, so a run of failures could not be diagnosed
-- after the fact — which is exactly the situation this column was added in.
--
-- Idempotent: safe to run more than once.

ALTER TABLE ararka.scans
  ADD COLUMN IF NOT EXISTS error_text text;

COMMENT ON COLUMN ararka.scans.error_text IS
  'Failure reason when status = ''error''. Null otherwise. Operator-facing; never contains key material.';
