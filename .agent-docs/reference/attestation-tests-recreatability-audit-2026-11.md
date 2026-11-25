---
provenance: llm-draft
created: 2026-11-25
last-modified: 2026-11-25
tags: [attestation, assessment, question-bank, import, audit]
related: [architecture-overview]
sources: [Drive folder 1bfiN6kVsQtr3XiFS2a2dhyNc8RE0l_Xm]
---

# Attestation tests: can they be recreated as native platform questions?

**Date:** 2026-11-25 · **Status:** audit complete, verified · **Decision pending:** option C (native) vs B (image) vs hybrid

## Question
Voluntary-attestation teacher tests (15 subjects, 2024, PDF + PDF answer key, from the shared Drive folder
`1bfiN6kVsQtr3XiFS2a2dhyNc8RE0l_Xm`) need to be taken inside dasavandir.org with auto-grading, % result,
results visible only to admins. Can questions be rebuilt as native text/LaTeX questions (C), or must they be
shown as PDF images (A/B)?

## Method
- 15 auditor agents, one per subject: read every page image (110 dpi; PDF text layer not trusted), rewrote every
  question, graded T (plain text) / F (needs notation) / I (needs image) / X (unreadable), recorded answer type
  and key answer.
- 3 independent verifier agents: seeded random sample (6–8 per subject, stratified by grade) compared to page
  images; every key flag re-derived; full mechanical key cross-check (key PDF text vs recorded answers) in
  STEM + language groups. Orchestrator re-confirmed every key misread firsthand.
- Working files (questions.json per subject, reports): session scratchpad `audit/` — not committed (contain full
  test content).

## Results (872 questions)
| Subject | Qs | T | F | I | Native-feasible | Recommendation |
|---|---|---|---|---|---|---|
| Math | 60 | 15 | 45 | 0 | 100% | native (KaTeX) |
| Armenian | 41 | 40 | 0 | 1 | 97.6% | native, Q20 image |
| History | 65 | 65 | 0 | 0 | 100% | native |
| English | 65 | 65 | 0 | 0 | 100% | native |
| Social studies | 60 | 60 | 0 | 0 | 100% | native |
| Elementary | 44 | 43 | 1 | 0 | 100% | native |
| Biology | 60 | 47 | 1 | 12 | 80% | mixed |
| Chemistry | 60 | 24 | 27 | 9 | 85% (≈90% w/ rewording) | mixed |
| Physics | 60 | 19 | 24 | 17 | 71.7% | mixed |
| Informatics | 70 | 51 | 19 | 0 | 100% | native |
| Geography | 60 | 57 | 3 | 0 | 100% | native |
| Russian | 65 | 65 | 0 | 0 | 100% | native |
| German | 65 | 64 | 1 | 0 | 100% | native |
| French | 65 | 65 | 0 | 0 | 100% | native |
| PE | 32 | 32 | 0 | 0 | 100% | native |
| **Total** | **872** | **712** | **121** | **39** | **95.5%** | |

- **Open-ended questions: 0** in all 15 subjects. Everything is auto-gradable.
- Answer types needed: single, multi (set), order (sequence), match (slots with distractors, unmatched allowed),
  numeric (incl. base-n strings → exact string match).
- UI needs: KaTeX, underline/italic/bold rich text, sticky shared passage (up to ~3,350 chars), per-question
  optional image (39 items), multi-line options.

## Verification
- Transcription: 92 sampled questions → 82 exact, 10 minor (cosmetic), **2 material** (both Armenian,
  look-alike-letter misreads: Q15 յամփ→յամբ, Q20 գտեց→գնեց). Armenian PDFs use ArmSCII-8 font encoding;
  a decoder makes letter-level diffing automatic.
- **Key misreads by auditors (recorded answer ≠ official key): 8 confirmed** — English Q47, Q57, Q58;
  Biology Q11, Q35; Chemistry Q11, Q26; Armenian Q4 (found only by the mechanical parser — missed by the
  sampled verification). Auditors wrote plausible "official key is wrong" stories on top of
  their own misreads (English ×3, Russian Q18), and one silently replaced the official key with its own answer
  (Chemistry Q26).
- Lesson: **never trust AI-transcribed answer keys; always diff mechanically against the key PDF** and store the
  official key verbatim, with disagreements flagged, not substituted.

## Genuine official-key / test defects (verified) — need subject-expert decision before go-live
- Social studies Q12 — options numbered 1,2,2,3; key "2" ambiguous.
- Elementary Q27 — asks for 3 false statements, 4 are false. Q29.2 — key 20, correct 250. (Check Q26: same key as Q27.)
- Geography Q45 — key gives relative height (3800), question asks absolute (4200). Q50 — sign error (14‰ vs ≈16.4‰).
- Chemistry Q20 — stem numbers inconsistent with key/options. Q26 — official key 3, chemically 4 looks right.
- Informatics Q44 — key 56 is bytes, question asks bits (448). Q62 — stem says "left", CSS moves right.
- French Q39 — 6 errors vs stated 5. Q65 — E→¶6, key says 7.
- Physics Q7 — options 2 and 3 printed identically (key still valid).
- Formatting-only: History Q65 key in Armenian letters (convert to 4,3,2,7,5,1,6); Russian Q56 4-digit key maps to А,Б,В,Д.
- Unverified (auditor-only, not re-checked): Geography Q55, Q58; PE Q14; Russian Q12/Q26/Q37; Biology Q50 (verifier: key OK under standard reading).
- Items relying on unstated constants: Biology Q51–52, Q58.

## Mechanical key import (built 2026-11-25)
- `lib/attestation-core.ts` `parseKeyText` (3 strategies: pairs / lines / glued) parsed **872/872** answers from
  the 15 real key PDFs via `pdf-parse`. Its only disagreements with the audit data are the 8 auditor misreads above.

## Implications for the decision
- C (native) is feasible for 95.5% of questions; the remaining 39 need a cropped figure → hybrid model
  (native question + optional image) covers 100%.
- Cost is review, not technology: every imported test needs (1) mechanical key diff, (2) native-speaker/subject
  proofread of transcribed text (esp. Armenian planted-error items: Armenian Q11/Q19/Q21, Elementary Q8/12/13),
  (3) expert ruling on the defect list above.
- Multi-select scoring (exact set vs partial credit) and point weights (some items worth 3 or 9 pts) still need an
  owner decision.
