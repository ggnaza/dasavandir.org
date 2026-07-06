---
provenance: llm-reviewed
template-version: 1.0.0
created: 2026-07-06
last-modified: 2026-07-06
related: [../lessons/prefer-service-role-routes-over-browser-writes.md]
tags: [video, playback, signed-url, learn]
---

# Calling `router.refresh()` during media playback restarts self-hosted lesson videos

**Observed:** Learners reported "the video stops and jumps to the beginning" around the 50% mark on
self-hosted (Supabase storage) lesson videos. `app/learn/courses/[id]/lessons/[lessonId]/page.tsx`
mints a **fresh signed URL on every server render** (`createSignedUrl(video_url, 28800)`).
**Root cause:** `video-tracker.tsx` called `router.refresh()` at 50% (to mark completion). The refresh
re-ran the server component → a NEW signed URL with a different token → the `<video src>` changed →
the browser reloaded the video from the start mid-playback.
**Workaround / fix (2026-07):** removed both `router.refresh()` calls (native + YouTube handlers);
progress still upserts to `progress`, local `marked` state shows the ✓, and the gate reflects
completion on next navigation.
**Avoid:** never call `router.refresh()` (or otherwise re-render the server tree) while media is
playing on this page — any signed-URL regeneration restarts the video. `chapter-view.tsx` already
avoids refresh and is fine.
**See also:** `video-tracker.tsx` · commit fixing the 50%-mark restart (2026-07).
