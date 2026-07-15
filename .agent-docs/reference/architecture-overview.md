---
provenance: human
template-version: 1.0.0
created: 2026-07-06
last-modified: 2026-07-06
related: [course-visibility-model, moderator-access-model, security-posture]
tags: [architecture, stack, overview]
---

# Architecture overview — Gor LMS

**What-it-is:** Next.js 14 (App Router) + Supabase (Postgres + Auth + Storage) + OpenAI/Gemini/Claude
+ Tailwind, deployed on Vercel. A learning-management system with role-based course access, an AI
coach, and video lessons.

**Environments:**
- Production domain: https://dasavandir-org-h82a.vercel.app (use for callback URLs / live-app URLs)
- GitHub repo: https://github.com/ggnaza/dasavandir.org
- Supabase project ref: `mmkmsudwtrqdzehnfctx` (`.env.local` holds the service-role key; same project
  as prod)

**Roles:** `admin` · `course_creator` · `course_manager` · `learner`. Each editor role links to
courses through its OWN table — `course_creator_access` (creator_id, course_id), `course_manager_access`
(manager_id, course_id), `enrollments` (user_id, course_id for learners). Using the wrong table
silently breaks that role's visibility (see CLAUDE.md §Role-to-course linking).

**Why the stack:** non-coder owner; chosen for simplicity, free-tier viability, and zero server
management. Don't add frameworks/libraries not already in the stack.

**Scope / where it applies:** the whole current single-tenant LMS. A future multi-tenant successor is a
clean-break separate build (ADR-0004).

**Last-verified:** 2026-07-06.
**See also:** ADR-0004 · CLAUDE.md · [[project-lms-stack]]
