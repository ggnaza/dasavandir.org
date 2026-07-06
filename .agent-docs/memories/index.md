---
provenance: kit-template
created: 2026-07-03
last-modified: 2026-07-06
tags: [meta, index, routing, memories]
related: [CONVENTIONS]
---

# memories/ — routing catalog

Non-obvious gotchas + findings, **titled as claims, not topics**. Tier-2 — loaded on demand when the
claim is relevant. UPDATE-IN-PLACE (rare). Schema authority: `../CONVENTIONS.md` (memory template).

> **Memory vs lesson vs ADR.** A *memory* is a standing gotcha/fact ("X behaves surprisingly because
> Y"). A *lesson* is a behavioral rule with promotion + decay (`lessons/`). An *ADR* is a settled
> decision (`decisions/`). When in doubt: did it change how we ACT (lesson) or decide a fork (ADR)?
> Otherwise it's a memory.

## Entry purpose + naming

- **Purpose:** capture a non-obvious finding so it isn't re-derived — the title IS the claim.
- **Filename:** `memories/<kebab-claim-as-title>.md`. Good:
  `build-needs-explicit-env-recipe`. Bad: `build-notes`.
- **Write-discipline:** UPDATE-IN-PLACE (rare).

## Entry SCHEMA (body)

Observed (when/where/how it surfaces) · Root cause (if known) · Workaround / fix · Avoid (specific
anti-actions) · See also (related docs, upstream issues, commit refs).

## Memories

- `router-refresh-restarts-self-hosted-video.md` — **Open when:** editing lesson video / completion tracking. **Carry-away:** never `router.refresh()` during playback — it regenerates the signed URL and restarts the video.
- `missing-embed-column-errors-whole-postgrest-query.md` — **Open when:** a Supabase query returns null/"empty" unexpectedly. **Carry-away:** a missing column in a `.select(embed)` errors the WHOLE query (`42703`); check `error`, not `!data.length`. `progress` has no `course_id`.
- `browser-storage-uploads-need-bucket-insert-policy.md` — **Open when:** an upload fails opaquely. **Carry-away:** suspect a missing bucket INSERT policy; prefer the signed-URL server flow over a storage-RLS migration.
- `next-build-typechecks-all-provider-branches.md` — **Open when:** before pushing / a Vercel build fails. **Carry-away:** strict `next build` type-checks ALL provider branches; a dormant one fails the deploy. Run it locally first.
- `vision-attachments-need-per-model-branch.md` — **Open when:** touching AI-coach attachments. **Carry-away:** each provider takes images differently (OpenAI `image_url`, Claude base64, Gemini inlineData); scanned PDFs are Gemini-only.
- `learner-auto-enroll-exposes-internal-wip-courses.md` — **Open when:** publishing an internal course. **Carry-away:** publishing an internal course auto-exposes it to every `@teachforarmenia.org` user immediately.

## Maintenance

UPDATE-IN-PLACE; adding/retiring a memory updates this index in the same change. Carry-away claims
must be traceable to the source memory.
