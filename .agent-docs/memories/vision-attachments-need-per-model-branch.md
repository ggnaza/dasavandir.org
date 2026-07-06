---
provenance: llm-reviewed
template-version: 1.0.0
created: 2026-07-06
last-modified: 2026-07-06
related: []
tags: [ai-coach, chat, vision, attachments, llm]
---

# Image/scanned attachments in the AI coach need a per-model vision branch

**Observed:** Image/scanned-PDF attachments "silently wouldn't attach" on the default OpenAI model —
they only worked on Gemini. Also phone photos > 3 MB failed and the client swallowed the error.
**Root cause:** the upload route blocked non-Gemini vision, and the chat route only forwarded the
attachment in its Gemini branch. Each provider takes images differently.
**Workaround / fix (2026-07):** `visionSupport(model)` → "full" (Gemini: images+PDF), "images"
(gpt-4o/4.1, claude-), "none". Chat route: OpenAI branch sends `image_url` data URLs; Claude branch
sends base64 `image` blocks; Gemini uses `inlineData`. Client `downscaleImage()` shrinks big photos
(canvas → JPEG, max 1600px) under a ~4 MB guard (Vercel body limit) with try/catch.
**Avoid:** don't assume one attachment shape works across providers; scanned PDFs remain Gemini-only
(OpenAI/Claude image APIs take images, not PDFs). `MAX_VISION_BYTES` = 3 MB (base64 must fit Vercel's
~4.5 MB body limit).
**See also:** `app/api/chat/upload/route.ts` · `app/api/chat/route.ts` · `ai-coach.tsx`
