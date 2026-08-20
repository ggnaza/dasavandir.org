---
provenance: llm-reviewed
created: 2026-07-03
last-modified: 2026-08-17
tags: [current, status, enrollments, invitations, bugfix]
related: [work-plan, open-questions, handoff]
---

# Status — dasavandir.org · Invitation-accept-before-enroll bug fixed → staging · 2026-08-17

## TL;DR
Operator report: a learner (**tatev@teachforarmenia.org**) was invited to a course, the invite email
arrived, **but she never appeared in the enrolled list and had no course access.** Forensics (Supabase
REST, service-role, prod project `mmkmsudwtrqdzehnfctx`) found the real cause: the three auto-enroll-on-
visit pages marked the invitation `status='accepted'` **concurrently** with the enrollment upsert in a
`Promise.all`, **never checking the enrollment result.** When the enrollment write failed, the invite
still flipped to `accepted` — and since auto-enroll only ever reprocesses `pending` invites, the user was
**permanently stranded**: no enrollment, no access, invisible in the roster, never retried. Re-inviting
did not help (invite upsert uses `ignoreDuplicates` on `(course_id,email)`, so it re-sends the email but
leaves the row `accepted`).

- **Immediate fix:** created Tatev's missing enrollment row directly in **prod** — she now has access.
- **Blast radius:** **18 learners** were stranded this way (16 on *Teacher Leadership Academy 2026*
  `88450829-…`, 2 on the Welcome course `ed7e3fd0-…`). Per operator decision, **only Tatev was fixed**;
  the other 17 are left un-backfilled → **OQ-014**.
- **Root-cause code fix:** new shared helper `lib/invitations/accept-pending.ts` marks the invite
  accepted **only after** the enrollment upsert succeeds (else it stays `pending` and retries next
  visit). Wired into all 3 call sites. **Merged to `staging` as PR #283 (`fba7a65`) — NOT yet on
  `main`.**

## ⚠️ Two open loops
1. **This session (new):** PR #283 is on `staging` only. Operator to test on `staging.dasavandir.org`,
   then say "push to main" to promote. **17 stranded learners still have no access** (OQ-014) — offer to
   backfill.
2. **Prior session (unchanged, still open):** WU-0005's `enrollment_suspension.sql` migration is **not
   confirmed applied to prod** (OQ-011). Untouched this session. Verify with a service-role REST read of
   `enrollments?select=status&limit=1` (→ `42703` if not applied).

## Branch / working tree
- On **`main`**, working tree = only the pre-existing `.agent-docs/*` doc edits (carried in from a prior
  uncommitted session) + this handoff's updates. No stray code changes; `tsconfig.tsbuildinfo` reverted.
- **Local `main` is behind `origin/main`** (local `f6faca9`; origin has #282 `72f46be` + possibly more).
  This session's code went to **`origin/staging`**, never local main. `git pull` before committing docs.
- All code work was done on a branch off **`origin/staging`** (staging is AHEAD of main — carries #280/
  #281 staff-access logic that main-based branches would clobber). See handoff trap.

## What shipped this session
- **PR #283** (`fba7a65`, merged to `staging`) — `fix: mark course invitation accepted only after
  enrollment succeeds`. New `lib/invitations/accept-pending.ts`; edits to `app/learn/page.tsx`,
  `app/learn/courses/[id]/page.tsx`, `app/learn/courses/[id]/lessons/[lessonId]/page.tsx`.
- **Prod data write:** 1 row — Tatev's enrollment (`user_id ffd523ff-…`, `course_id ed7e3fd0-…`).

## Build / test state
- Gate = **`tsc --noEmit`** (clean, verified on both the main-based and staging-based trees).
- `next build` **OOM-crashes (SIGABRT)** at default heap; use
  `NODE_OPTIONS=--max-old-space-size=8192 npm run build` — compiles + type-checks + generates all 115
  routes cleanly. No ESLint/Prettier gate (`next lint` prompts for interactive setup — not wired).
- Not runtime-tested against a stranded-user session (would need that user's auth); logic verified by
  code review + typecheck + build. The data fix (Tatev) WAS verified live via REST read-back.

## Data forensics captured
- Prod project = `mmkmsudwtrqdzehnfctx` (the `.env.local` target — holds real data). Staging project =
  `zzaiyqvlkdjiqnuluznl` (`.env.staging`) — had NO Tatev records (confirms prod is where this lives).
- Stranded-user query: accepted invitations diffed against enrollments (via profiles email→id map).
  18 stranded, 0 accepted-but-no-profile. Reproducible script logic in handoff §Immediate-next.
