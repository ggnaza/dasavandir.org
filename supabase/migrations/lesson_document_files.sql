-- Multiple inline PDF documents per lesson.
-- lessons.document_files: jsonb array of { "url": text, "name": text }.
-- lessons.document_url stays = the first file's url (legacy readers).
-- Idempotent: the backfill only touches lessons that have a document_url and
-- no document_files yet (name '' = derive from the file name). Not related to profiles / handle_new_user().
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS document_files jsonb NOT NULL DEFAULT '[]'::jsonb;
UPDATE lessons SET document_files = jsonb_build_array(jsonb_build_object('url', document_url, 'name', '')) WHERE document_url IS NOT NULL AND document_url <> '' AND document_files = '[]'::jsonb;
