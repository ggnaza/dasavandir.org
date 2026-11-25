---
provenance: llm-draft
created: 2026-11-25
last-modified: 2026-11-25
tags: [review, attestation, security, grading]
related: [0010-attestation-tests-native-questions]
---

# REV-001 — Attestation module (commit 8acff34), independent code review

**Scope:** `git diff origin/staging..8acff34` (attestation module, ADR-0010). **Method:** clean-context
reviewer agent, read-only; ran unit tests and tsc; probed `numericEquals` edge cases.
**Verdict:** no blockers; every authz path holds (no key/score/foreign attempt reaches a non-manager).
3 major, 5 minor, 3 nit — all FIXED in the follow-up commit.

| ID | Sev | Finding | Disposition | Test obligation |
|---|---|---|---|---|
| REV-001-F01 | MAJOR | Autosave read-merge-write race loses answers | FIXED — `attestation_merge_answers` RPC merges in one UPDATE; client saves serialized | unbound → manual: two rapid answers on slow network (staging acceptance) |
| REV-001-F02 | MAJOR | Submit can grade before last save lands | FIXED — submit awaits save chain and carries full answer set, merged before grading | unbound → manual: change last answer then submit immediately |
| REV-001-F03 | MAJOR | e2e grant helper missing `attestation`; `canEnter` allowed missing keys | FIXED — helper updated; `canEnter` deny-by-default | `e2e/20-module-access.spec.ts` (5/5) |
| REV-001-F04 | MINOR | `numericEquals` accepted `0b…`/`0x…`/`1e3` | FIXED — plain-decimal regex gate | `lib/attestation-core.test.ts` "rejects JS literals" |
| REV-001-F05 | MINOR | Comma handling: second separator, Unicode minus | FIXED (minus, multi-separator). Single comma stays decimal — WONTFIX as thousands: Armenian convention, source tests use "0,25" | same test |
| REV-001-F06 | MINOR | Published tests editable into ungradable state; no regrade | FIXED — published: no add/delete/type change, key must validate, no needs_review; `POST …/regrade` + Results button | unbound → manual |
| REV-001-F07 | MINOR | Expired attempts never finalized if teacher doesn't return | FIXED — `finalizeExpired` on Results and teacher home | unbound → manual |
| REV-001-F08 | MINOR | Import passage map collides on explicit positions | FIXED — position = bundle order | unbound → import of 15 bundles |
| REV-001-F09 | NIT | `module_access.sql` CHECK omits attestation (re-run fails) | FIXED | — |
| REV-001-F10 | NIT | `passage_id` not scoped to the question's test | FIXED — `passageInTest` on create/update | — |
| REV-001-F11 | NIT | CSV formula injection in names | FIXED — leading `=+-@` prefixed with `'` | — |
