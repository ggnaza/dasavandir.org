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
   open. Attempts with `deadline_at` null (created before this change) fall back to the test's current limit.

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
