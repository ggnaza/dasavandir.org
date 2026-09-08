---
provenance: llm-draft
status: accepted
template-version: 1.0.0
created: 2026-09-08
last-modified: 2026-09-08
work-unit: WU-0017
supersedes: []
superseded-by: null
related: [gnahatum-learning-layer]
tags: [architecture, gnahatum, scoring, ai, independence]
---

# ADR-0008 — Gnahatum scores in two passes: transcribe from the image, grade from text only

## Context
Scans arrive both graded and ungraded. Reading 450 stored items showed the single-pass scorer
deriving awards from the teacher's red ink on illegible answers ("the teacher awarded full points,
so I will follow that"). The observed rate is low (2 unambiguous cases / 450) but it is a floor: it
is only visible when the model narrates it. A prompt prohibition (#341) is a request, not a
guarantee, for as long as the grading step can see the marks.

The operator's stated requirements: the model reads the student's text and grades *that*; it
disregards teacher scores; it learns from corrections; and scoring accuracy is measurable. The
planned benchmark uses hand-graded papers, so any leakage would inflate the accuracy figure exactly
where it matters most.

## Alternatives Considered
- **Keep single pass + hardened prompt + detection (#341).** Rejected as the end state — independence
  stays a request. Kept as defence-in-depth for the transcription pass.
- **Crop or mask red ink before scoring.** Rejected — marks are not reliably red, not reliably
  outside the answer boxes, and the pipeline has no image-processing stage.
- **Two passes, image-free grading (chosen).** Pass 1 sees the scan and only transcribes the
  student's writing. Pass 2 sees the transcript + answer key + learned knowledge, never the image.
  The grader *cannot* consult a mark it never sees. Costs one extra text-only call; drawings must
  be described in words by pass 1, which is lossy for figure questions.
- **Hybrid: text grading except for diagram/essay questions, which get the image.** Rejected for
  now — most independence per unit of complexity comes from the pure split; the hybrid reintroduces
  the leak precisely on the questions where teacher comments are commonest (Q15). Revisit if
  drawing questions benchmark badly.

## Decision
1. `scoreFromScan` keeps its signature (both callers unchanged) but runs two model calls.
2. **Pass 1 (transcription)** receives the question *structure* only — numbers, types, sub-part
   labels — not the correct answers, so reading cannot be biased toward the key. It returns each
   student answer as text, a per-question legibility score, and the header names.
3. **Pass 2 (grading)** receives the transcript, the full answer key with rubrics, and the learned
   block. It returns awards, the arithmetic (`points_breakdown`), and a judging confidence.
4. `extracted_answer` and `correct_answer` are filled server-side from the transcript and key; the
   grader cannot rewrite the transcript. Final `confidence = min(legibility, grading confidence)`.
5. Server-side flags stay: award-vs-arithmetic mismatch, and any mention of teacher marks in
   *either* pass (leakage into the transcript is the residual risk).
6. `ai_raw` stores both raw responses.

## Consequences
- Teacher-mark independence becomes structural. Hand-graded papers are safe as a gold set.
- Corrections now teach against a transcript the operator can read and correct too.
- Drawing questions are graded from a description; if that costs accuracy the hybrid is the
  documented next step.
- +1 text-only call per scan (cheap); latency roughly +30–50%.
