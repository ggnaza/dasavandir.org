---
provenance: llm-reviewed
template-version: 1.0.0
created: 2026-07-06
last-modified: 2026-07-06
related: [../lessons/prefer-service-role-routes-over-browser-writes.md]
tags: [storage, rls, uploads, signed-url]
---

# Browser-client storage uploads fail opaquely when a bucket lacks a staff INSERT policy

**Observed:** Uploads fail with "The database schema is invalid or incompatible" or "new row violates
RLS" from the browser client. Buckets: `course-covers` (covers), `lesson-documents` (PDFs),
`lesson-files` (attachments + learner submissions + capstone). `course-covers`/`lesson-documents` got
INSERT policies via migrations; `lesson-files` never did.
**Root cause:** a missing INSERT policy on `storage.objects` for that bucket; the error surfaces as an
opaque schema/RLS message, not "you lack permission."
**Workaround / fix (2026-07, staff attachments):** made the flow RLS-INDEPENDENT instead of adding
another storage-RLS migration — `POST /api/files/upload-url` mints a signed upload URL with the
service-role client, client calls `uploadToSignedUrl(path, token, file)`, then `POST /api/files/record`
saves the row; deletion routes through `DELETE /api/files/record` (admin client).
**Avoid:** don't debug opaque upload failures as client bugs — suspect a missing bucket INSERT policy,
and prefer the signed-URL server flow over a manual storage-RLS migration (migrations lag prod).
**Caveat:** learner submission + capstone uploads still write directly to `lesson-files` via the
browser client (`assignment-submitter.tsx`, `capstone-submitter.tsx`) — not yet converted.
**See also:** [[feedback-rls-auth-safety]] · ADR-0002
