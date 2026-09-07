---
id: LP-011
entry_type: lesson
provenance: llm-reviewed
template-version: 1.0.0
maturity: seedling
status: active
severity: medium
module: planning
type: process
tags: [verification, environment, browser, pdfjs, sunk-cost, spike, gotcha]
created: 2026-09-07
last-modified: 2026-09-07
last-applied: 2026-09-07
superseded-by: null
---

# Probe an unfamiliar runtime capability with a minimal case BEFORE building a feature on it

## Question
When a planned feature depends on a runtime API I have not exercised in THIS environment (canvas
rendering, a worker, a native module, a device API), should I build the feature and find out, or probe
first?

## Claim (the lesson)
Probe first, with the smallest possible case. A capability probe costs minutes; discovering the gap
after the feature is written costs the whole build **plus** the back-out — and, more dangerously, the
sunk cost then argues for shipping the thing unverified ("it probably works in a real browser").

The probe must be minimal enough that a failure implicates the *environment*, not your code. A
760-byte, single-shape document on a tiny canvas either renders or it doesn't; a 28MB multi-page PDF
through your own pipeline tells you nothing about which layer broke.

## Evidence
2026-09-07 (Ararka session, WU-0014). To get under Vercel's 4.5MB request-body limit I implemented
client-side PDF rasterisation end to end — `lib/ararka/compress-pdf.ts` (pdfjs render → JPEG → rebuilt
PDF via pdf-lib), wired into the uploader with progress and oversize reporting. Only then did I find
that `pdfjs.page.render()` **never settles** in the embedded browser pane. I spent several turns
assuming it was slow, or that noise images were pathological, before isolating it: a **760-byte
vector-only PDF on a 200×200 canvas also timed out**, proving it was the environment.

The feature was backed out entirely (never committed) and a different design shipped instead —
signed-URL upload straight to Supabase Storage (PR #322) — which needed no rasterisation and was
verifiable server-side end to end.

## Trigger
About to write more than a few lines against a runtime API whose behaviour in the current execution
environment is unverified.

## Failure mode
Wasted build plus back-out, and a live temptation to ship unverified code onto users' machines to avoid
"wasting" the work. The correct move at that point — discard it and choose a verifiable design — is
harder the more you have already written.

## Related
`now/handoff.md` §Anti-assumptions #5 (pdfjs render in the Browser pane) · `standing-rules-core.md`
§Hands-on acceptance
