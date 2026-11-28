---
provenance: llm-draft
status: proposed
template-version: 1.0.0
created: 2026-11-28
last-modified: 2026-11-28
work-unit: null
supersedes: []
superseded-by: null
related: [0010-attestation-tests-native-questions, module-access-is-the-live-ldm-source, staging-shares-the-production-database]
tags: [attestation, module-access, invitations, timer]
---

# ADR-0011 — Attestation managers, per-test invitations, and a frozen per-attempt deadline

## Context
Operator asks (2026-11-28): (1) a place to add attestation managers, not just the one granted by hand;
(2) inviting a teacher must name the subject — a teacher is invited to specific tests, not all 15;
(3) a timer for the whole test. A per-test `time_limit_minutes` with a server-enforced deadline and
auto-submit already existed (ADR-0010) but was buried in each test's details and unset on all 15 tests,
and the clock started the moment the test page opened.

## Decision
1. **Managers panel, admin-only.** Platform admins add/remove `module_access(module='attestation',
   access='ldm')` by email from Manage tests. Managers cannot create managers (no self-propagating staff
   grants); they keep inviting teachers.
2. **Per-test invitations.** New table `attestation_invites(test_id, user_id)`, RLS on, service role only.
   `module_access` `member` remains the entry gate (it drives the nav link); a member sees and can open only
   the tests they are invited to. Managers and admins see every published test. Removing a teacher's last
   invitation removes their `member` row too.
3. **Timer.** The time limit is set from the Manage tests list (per test, or one value for all). Each
   attempt stores `deadline_at` when it starts, so changing a limit never shortens or extends a teacher who
   is already inside the test. A start screen states the duration; the clock starts on "Start", not on page
   open. `deadline_at` null means untimed — the test's current limit is never consulted for a live attempt;
   the migration backfills open attempts on tests that were already timed.

## Alternatives Considered
- **Managers can add managers.** Rejected: one compromised or careless manager could mint more staff who
  see every result. Admin-only is one extra hop for a rare action.
- **Invite by subject string instead of test id.** Rejected: subjects are free text on the test; a test id
  is exact, and today there is one test per subject, so the UI still reads as "choose the subject".
- **Keep module-wide access and add a subject filter only in the UI.** Rejected: the API would still let an
  uninvited teacher open any test by URL — the restriction must be server-side.
- **Store invitations inside `module_access` (e.g. a jsonb of test ids).** Rejected: a module-level table
  shared with Efficacy/Gnahatum should not carry attestation-specific shape; a join table gets FKs and
  cascades for free.
- **Compute the deadline from the test's current limit (status quo).** Rejected: a manager editing the
  limit mid-session would instantly expire or extend live attempts.

## Consequences
- Migration `attestation_invites_and_deadline.sql` must be applied before the code deploys (shared DB).
- A teacher granted before this change with no invitations sees no tests until invited (there were none).

## Independent review (2026-11-28, clean-context reviewer on b86bcc1) — dispositions
- R1 major, null `deadline_at` meant both "untimed" and "legacy" so limit edits still hit live attempts — **FIXED**: null = untimed, migration backfill for timed legacy attempts (0 rows on 2026-11-28: no test had a limit).
- R2 major, leftover invites + no member row → re-invite reported "already" and granted nothing — **FIXED**: invite always rewrites the member row; removing a manager clears their invites.
- R3 minor, takers DELETE count-then-delete race — **WONTFIX**: needs a concurrent invite of the same teacher in the same ~ms; R2's fix makes the next invite repair it.
- R4 minor, unfiltered invites read capped at max-rows — **FIXED**: read per chunk of 50 teachers.
- R5 minor, withdrawn invite did not stop an open attempt — **FIXED**: autosave and submit return 403; re-inviting resumes it.
- R6 minor, saving one time-limit row discarded unsaved edits in others — **FIXED**: only saved rows refresh.
- R7 nit, auto-resume could silently open a new timed attempt after the old one expired — **FIXED**: `?resume=1` never opens a new attempt; the start screen shows instead.
- R8 nit, takers POST accepted draft/archived ids — **FIXED**: published only.
- R9 nit, non-admin managers make one GET that returns 403 — **WONTFIX**: harmless; the panel hides itself.
- Pre-existing, failed auto-submit retried every second — **FIXED** (once only, error shown).
- Pre-existing, home page finalizes every user's expired attempts on listed tests; manager reset unscoped — **TRACKED** here, harmless while all managers see all tests.

## Amendment (2026-11-28, before build) — emailed invitations create accounts
Operator: invited teachers "should create an account and appear in their test page, with a start button".
- **Decision:** inviting an email with no account creates it (`auth.admin.generateLink` type `invite`) and
  emails a one-time link → `/auth/set-password?next=/attestation` (asks for a name if missing) → their tests.
  Re-inviting anyone who never signed in sends a fresh `magiclink` (fixes expired links). Active teachers are
  emailed only when a subject is newly added. Invited accounts are created `active`, never `pending`.
- **Found while building (pre-existing bug, fixed here):** `/auth/set-password` POSTs `/api/auth/activate`,
  which had only GET (405). Admin-invited users therefore stayed `pending` and the hourly
  `cleanup-unverified` cron deleted them 24h after creation even after they set a password. Added the POST.
- **Alternatives considered:** (a) keep "must sign up first" — rejected by the operator; (b) Supabase's own
  `inviteUserByEmail` — rejected: English Supabase template, and the app already sends branded mail via
  Resend; (c) a pending-invitations table that activates on signup — rejected: more moving parts, and the
  teacher would still have to find the signup page themselves.

### Independent review of 4b838a8 (2026-11-28) — dispositions
- E1 major, activate POST let a pending self-signup skip email activation — **FIXED**: only sessions whose `amr` shows an emailed link (otp/invite/magiclink/recovery) may self-activate; unit-tested.
- E2 major, "never signed in" via `last_sign_in_at` broken by link scanners — **FIXED**: acceptance is `app_metadata.invite_accepted` set by activate; every re-invite emails (fresh link while not accepted).
- E3 major, link origin from Host header — **FIXED**: our hosts only, else `NEXT_PUBLIC_SITE_URL`; unit-tested.
- E4 major, 100 sequential account creations vs 60s — **FIXED**: batches of 10, 50 per request.
- E5 minor, `safeNextPath` tab/newline bypass — **FIXED**, unit-tested.
- E6 minor, auth user without profile could never be invited — **FIXED**: magiclink fallback + ensureProfile.
- E7 minor, magiclink for an unconfirmed invited user unverified — **TRACKED**: hands-on on staging (re-invite path).
- E8 minor, abuse ceiling — **FIXED**: 300 new accounts per manager per day; no re-send within 10 minutes.
- E9 nit, retry wording — **FIXED** by E2. E10 nit, name prompt reads metadata not profile — **WONTFIX**: server never overwrites an existing name.
- Discoveries (pre-existing, not changed here): `/auth/callback` follows an unvalidated `next` (`//evil` open redirect); signup marks an account active when the activation email fails; `sendActivationEmail` puts the URL in href unescaped (server-built).
