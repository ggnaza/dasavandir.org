---
provenance: llm-reviewed
template-version: 1.0.0
created: 2026-07-06
last-modified: 2026-07-06
related: [../reference/course-visibility-model.md]
tags: [enrollment, visibility, tfa, internal-courses]
---

# `@teachforarmenia.org` users are auto-enrolled into every internal published course

**Observed:** `/learn/page.tsx` auto-enrolls every `@teachforarmenia.org` user into ALL
`course_type='internal'` + `published=true` courses.
**Root cause:** intentional convenience for TFA staff, but it means internal WIP courses become visible
to all TFA staff the MOMENT they are published.
**Avoid:** do not publish an internal course before it's ready assuming it's hidden — publishing an
internal course exposes it to every TFA staff account immediately. Keep unfinished internal courses at
`published=false`.
**See also:** reference/course-visibility-model · ADR-0003
