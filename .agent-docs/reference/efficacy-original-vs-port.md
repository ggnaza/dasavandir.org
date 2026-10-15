---
provenance: llm-draft
created: 2026-10-15
last-modified: 2026-10-15
tags: [efficacy, architecture, migration]
related: [architecture-overview]
sources: [github.com/vahehovsepyantfa-sketch/teacher-efficancy-tool]
---

# Efficacy tool — Vahe's original vs. our Aug–Sep 2026 port

Recorded 2026-10-15. Problem the operator raised: the "port" (PRs #308–#311, #325–#328) is a
**rebuild**, not Vahe's tool. Goal: run Vahe's tool as-is on our Vercel + Supabase, with teachers
sharing one identity across the LMS and Efficacy.

## The original
- Repo: `github.com/vahehovsepyantfa-sketch/teacher-efficancy-tool` (private; operator's `gh` can read it).
- `main` last commit 2026-07-18 (`4496a32`, 56 commits). Unmerged branches ahead of main:
  `claude/limit-ai-evaluation-concurrency` (+2: AI-evaluation queue with position/ETA),
  `claude/ui-ux-improvements` (+1: UI/UX audit fixes). `full-build-out` is fully merged.
- Stack: Express + MongoDB (Mongoose) + own JWT auth (email/password, self-register → admin approval),
  React 18 + Vite + React Router + axios, Gemini (`@google/genai`), PDFKit, pdf-parse, xlsx.
  Hosted on Render free tier (API + static frontend).
- Roles: `admin`, `ldm`, `teacher` (teacher has `assignedLdm`).
- 11 Mongo models: User, TeacherReflection, LessonObservation, CompetencyEvaluation, Manifestation,
  ChatConfig, ChatSession, UsageStat, AiEvaluation, KnowledgeSource, KnowledgeChunk.
- ~15.5k lines across backend + frontend.

## What the port missed or changed
- Frontend rewritten from scratch in Next.js/Tailwind — not Vahe's UI/design system (TFA orange tokens,
  charcoal sidebar, mobile bottom tabs, Lato + Noto Sans Armenian).
- Not ported: AI lesson evaluation (Drive video + lesson plan → Gemini, up to 30 min, ≤1.95 GB video),
  knowledge base (file/video sources, RAG chunks, "learned" Q&A entries), PDF exports (observation,
  evaluation), AI reflection feedback, AI competency score suggestions, teacher profile / LDM reflection
  review, user approval flow, voice input, growth chart.

## Hosting constraint to design around
The video evaluation is a long-running job (download to /tmp, poll Gemini up to 30 min). Vercel functions
cap at 800 s (Pro) with limited /tmp, so it cannot run unchanged inside a Vercel request.
