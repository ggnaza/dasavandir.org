---
provenance: llm-draft
status: proposed
template-version: 1.0.0
created: 2026-11-25
last-modified: 2026-11-25
work-unit: null
supersedes: []
superseded-by: null
related: [attestation-tests-recreatability-audit-2026-11, module-access-is-the-live-ldm-source, staging-shares-the-production-database]
tags: [attestation, assessment, module-access, supabase, import, grading]
---

# ADR-0010 — Voluntary-attestation tests as native questions in a new `attestation` module

## Context
TFA wants teachers to take the official voluntary-attestation subject tests (15 subjects, PDF test + PDF answer
key) inside dasavandir.org, auto-graded to a percentage, with results visible only to TFA staff. The
recreatability audit (`reference/attestation-tests-recreatability-audit-2026-11.md`) found 95.5% of 872
questions recreate exactly as text/LaTeX, 39 need a figure, 0 are open-ended, and that AI-transcribed answer
keys are unreliable (7 confirmed misreads) while the key PDFs' text layers parse mechanically.

Operator decision (2026-11-25): build approach C (native questions). Deferred, to be answered later: partial
credit for multi-answer items, per-item point weights, retakes, and exactly who besides admins sees results.

## Decision
1. **Separate module `attestation`** (path `/attestation`), registered in `lib/modules.ts`, gated by
   `public.module_access`. `member` = may take published tests. `ldm` (labelled "Manager") = may manage tests
   and see results, same as platform `admin`. Teachers never see their score — only "submitted".
2. **Native question model** in `public.attestation_*` tables: tests → passages (shared stimuli) → questions
   (markdown + KaTeX prompt, typed options, optional private-bucket figure, typed correct answer, points,
   scoring mode, needs_review flag) → attempts (answers jsonb, per-item results, score, percent).
   RLS on, no client policies — every read/write goes through API routes with the service-role client.
3. **Answer types**: single, multi, order, match, numeric, short_text. `open` is not supported (audit found 0).
4. **Scoring is data, not code paths**: each question has `points` (default 1) and `scoring`
   (`all_or_nothing` default, or `partial`). The deferred decisions become an admin edit, not a rebuild.
5. **Answer keys are imported mechanically**: a pure parser reads the key PDF's text layer (or pasted text) into
   per-question raw answers, normalises them per answer type, and shows a diff for the admin to apply. No AI in the
   key path. Anything unparsed stays empty and must be entered by hand.
6. **Questions import as a reviewed JSON bundle** (produced offline from the audit; kept out of git because it is
   the full test content). Imported items with a missing figure or an unresolved key flag land
   `needs_review = true`; a test cannot be published while any item needs review or lacks a key.
7. Figures live in a private Storage bucket `attestation`; pages get short-lived signed URLs.

## Alternatives Considered
- **A — show the PDF + answer sheet.** Fastest, faithful by construction. Rejected: the audit showed native is
  feasible for 95.5%, and native gives mobile, search, reuse and question-bank generation later.
- **B — every question as a cropped image.** Rejected as the default for the same reason; kept *per question* via
  the optional figure (covers the 39 figure items).
- **Extend course quizzes (`quizzes` / lesson quiz).** Rejected: single-correct-option schema, learner sees the
  score and correct answers, enrollment/sequencing semantics don't fit a standalone exam with hidden results.
- **Reuse Gnahatum (`ararka` schema).** Rejected: Gnahatum scores scanned paper with AI against 15-question keys;
  different input (scans), different trust model (AI grading), different users.
- **AI extraction of keys at import time.** Rejected by the audit evidence: AI misread 7 keys and fabricated
  justifications; the text layer is exact.
- **Supporting `open` questions now.** Deferred: none exist in the source tests; would need a manual-grading UI.

## Consequences
- New migration `attestation_tests.sql` (tables, RLS, bucket, module_access CHECK widened). Staging shares the
  production database, so applying it is a production change — idempotent, operator-applied.
- `ModuleId` gains `attestation`; every hard-coded grant map (`noAccess`, `adminGrants`, the access toggle)
  must list it.
- Publishing is blocked until each test's flagged items are resolved by a subject expert.
