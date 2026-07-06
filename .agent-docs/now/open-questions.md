---
provenance: llm-reviewed
created: 2026-07-03
last-modified: 2026-07-06
tags: [current, open-questions]
related: [status, work-plan]
---

# Open questions — Gor LMS

> `OQ-NNN` is the single source. Reference by number. Resolve → move the item to "Recently resolved"
> with a closure reference (a commit / `ADR-NNNN` / log entry). Surface gaps loudly — an honest
> open-question beats a polished plan with a hidden assumption.

## Open

- **OQ-001** (🟡 blocker; surfaced 2026-06 by the video-duration feature) — Why does `GOOGLE_API_KEY`
  read as "not set" server-side even though it's set in Vercel, and which Drive URL formats fail with
  "could not extract file ID"? **Resolve:** debug Vercel env-var scoping / missing redeploy, and get a
  sample failing Drive URL from the user. Relates: WU-0003, [[project-video-duration]].
- **OQ-002** (🟡 product/policy; surfaced 2026-07 by the visibility audit) — Should the public
  `/courses` marketplace stay browsable to learners under the enrolled-only policy, or be gated?
  **Resolve:** a product call by Gor (marketplace drives self-signup vs. strict enrolled-only). Relates:
  ADR-0003, reference/course-visibility-model.

## Recently resolved

<!-- move resolved items here with their closure ref: -->
