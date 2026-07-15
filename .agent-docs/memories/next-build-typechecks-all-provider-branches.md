---
provenance: llm-reviewed
template-version: 1.0.0
created: 2026-07-06
last-modified: 2026-07-06
related: [../lessons/verify-prod-schema-before-debugging-live-breakage.md]
tags: [build, vercel, typescript, deploy, llm]
---

# Vercel's strict `next build` type-checks ALL provider branches — a dormant one can fail the deploy

**Observed:** Code runs fine on the dev server but the Vercel deploy fails to build. The dev server
compiles loosely; `next build` runs strict and type-checks EVERY branch, including provider code paths
that never execute at runtime (e.g. the OpenAI branch while live runs Gemini).
**Root cause:** dead-at-runtime ≠ dead-at-compile. A type error in a dormant LLM-provider branch still
fails `next build`.
**Workaround / fix:** run `next build` locally before pushing, with
`NODE_OPTIONS="--max-old-space-size=4096"` (the build is memory-hungry). Treat a green dev server as
necessary-not-sufficient.
**Avoid:** don't push on "it compiles in `next dev`" — that's the IMPL-not-WIRED trap for deploys.
**See also:** [[project-manual-migrations]] · [[feedback-github-pr]]
