---
provenance: llm-reviewed
created: 2026-08-17
last-modified: 2026-08-17
tags: [current, handoff, session-state]
related: [status, work-plan, open-questions]
generator: /handoff
---

# Session handoff — READ FIRST (2026-08-17) · 🎯 Invitation-accept-before-enroll bug fixed → staging

## Project in one paragraph
`dasavandir.org` — a Next.js (App Router) + Supabase LMS. Prod DB project = `mmkmsudwtrqdzehnfctx`
(`.env.local` target, holds real data); staging DB = `zzaiyqvlkdjiqnuluznl` (`.env.staging`). Deploy
flow: Claude's changes PR to **`staging`** → operator tests on `staging.dasavandir.org` → operator says
"push to main" → promotion PR `staging → main`. Migrations are **hand-applied** by the operator in the
Supabase SQL editor (no auto-runner). This session fixed a learner-enrollment bug and shipped it to
`staging` (PR #283); it is **not yet on `main`.**

## Current state summary
An operator report — "tatev@teachforarmenia.org was invited, got the email, but isn't in the enrolled
list and has no access" — turned out to be a real, systemic bug. The three auto-enroll-on-visit server
pages marked an invitation `status='accepted'` **concurrently with, and blind to,** the enrollment
upsert (an unchecked `Promise.all`). When the enrollment write failed, the invite still flipped to
`accepted`; auto-enroll only ever reprocesses `pending` invites, so the user was **permanently
stranded** (no enrollment, no access, invisible in rosters, never retried). **18 learners** were in this
state. Tatev was fixed directly in prod (enrollment row created); the root cause was fixed in code
(shared `lib/invitations/accept-pending.ts`, wired into all 3 sites) and merged to `staging` as
**PR #283 (`fba7a65`)**. The other **17 stranded learners were left un-backfilled per operator
decision** (OQ-014).

## Important context
- **Invite ≠ enrollment.** `POST /api/invitations/invite` only writes an `invitations` row + sends an
  email. The invite becomes an enrollment only when the invitee signs up AND visits `/learn` (or a
  course/lesson page), where auto-enroll fires. The **enrolled list is driven by `enrollments`**, and
  pending invites show as a separate "Pending invites" list.
- **The fix (WU-0006):** `lib/invitations/accept-pending.ts::acceptPendingInvitations(admin, userId,
  invites)` upserts the enrollment, and marks the invite `accepted` **only if that upsert returned no
  error** (else leaves it `pending` to retry). Idempotent. Wired in `app/learn/page.tsx`,
  `app/learn/courses/[id]/page.tsx`, `app/learn/courses/[id]/lessons/[lessonId]/page.tsx`.
- **Deploy discipline** (CLAUDE.md): default PR target is `staging`; never `--base main` without an
  explicit "push to main". Migrations hand-applied + must be idempotent.
- **Prior open loop still live:** WU-0005's `enrollment_suspension.sql` migration is not confirmed
  applied to prod (OQ-011) — untouched this session.

## ⚠️ Anti-assumptions / traps
1. **"Invite sent + email received" does NOT mean enrolled.** The obvious read ("the invite failed") was
   wrong — the invite succeeded; the *enrollment* silently failed later, at first login. Diagnose by
   checking `enrollments`, not `invitations`.
2. **A `status='accepted'` invite with NO enrollment is the bug signature — and it is self-perpetuating.**
   Auto-enroll filters `status='pending'`, so it never revisits an `accepted` row; and re-inviting uses
   `upsert(..., {onConflict:'course_id,email', ignoreDuplicates:true})`, which re-sends the email but
   leaves the row `accepted`. So "just re-invite them" LOOKS like a fix but does nothing. The code fix
   (#283) stops NEW strandings; it does **not** retro-fix existing ones — those need a data backfill.
3. **`staging` is AHEAD of `main`.** It carries #280/#281 staff-access logic (`checkCourseAccess`/
   `isStaff`, extra enrollment columns) that `main` lacks. I first edited the fix on the `main` tree,
   then had to REDO every edit after branching off `origin/staging` — the main-based edits didn't match
   the staging files (would clobber the staff logic). **Cut the branch off `origin/staging` BEFORE
   editing** for any staging-targeted change. (LP-004 accepted; LP-006 staged.)
4. **`gh pr merge` prints a scary git error after a SUCCESSFUL merge.** "Not possible to fast-forward,
   aborting" is `gh` failing to sync the *local* branch post-merge — the PR was already MERGED on the
   remote. Verify with `gh pr view <n> --json state,mergedAt,mergeCommit` before reacting. (LP-008
   staged.)
5. **`next build` OOM-crashes (SIGABRT) at default heap.** Use `tsc --noEmit` as the fast gate, or
   `NODE_OPTIONS=--max-old-space-size=8192 npm run build` for a full build (compiles + type-checks +
   generates all 115 routes). (LP-007 staged — 3rd session confirming.)
6. **Shell/tooling foot-guns in this env:** `UID` is a readonly numeric var in zsh — assigning a UUID to
   it fails with "bad math expression"; use another name. Python `urllib` hits `CERTIFICATE_VERIFY_FAILED`
   here — use `curl` for Supabase REST and pipe to python for processing. `next lint` standalone prompts
   for interactive ESLint setup (not a wired gate).

## Detour-chain
- **MAIN:** "Tatev was invited but has no access — fix it."
  - **→ Forensics** (Supabase REST, service-role): Tatev HAS a profile (signed up), invite
    `status='accepted'`, but ZERO enrollments. Course `ed7e3fd0-…` (Welcome), `access_type='private'`.
    → root cause = unchecked-parallel accept-vs-enroll.
  - **→ Immediate data fix:** created Tatev's enrollment row in prod (verified via read-back). ✅ resolved.
  - **→ Blast-radius sweep:** diffed all `accepted` invitations vs `enrollments` → **18 stranded** (16 TLA
    2026, 2 Welcome). Operator: fix only Tatev, leave 17 (→ OQ-014). Open.
  - **→ Root-cause code fix:** extracted `acceptPendingInvitations()`, wired 3 sites. Branch off
    `origin/staging` (after a false start on `main` — trap #3). Typecheck + build gates pass. Merged
    PR #283 to `staging`. ✅ code done; ⏳ pending promote to `main`.
- **Untouched:** WU-0005 migration verification (OQ-011) — orthogonal, still open.

## Immediate next steps
1. **Operator tests #283 on `staging.dasavandir.org`** (invite a fresh test learner, confirm they land in
   the enrolled list on first login). Then, on operator "push to main":
   ```bash
   gh pr create --base main --head staging --title "release: invitation-accept-before-enroll fix (#283)"
   gh pr merge <n> --squash   # then verify: gh pr view <n> --json state,mergedAt
   ```
2. **Offer to backfill the 17 stranded learners (OQ-014).** Recipe (service-role REST; keys in
   `.env.local` — read, never print). Diff logic used this session:
   ```text
   fetch invitations?status=eq.accepted&select=email,course_id
   fetch profiles?select=id,email  ; fetch enrollments?select=user_id,course_id
   stranded = accepted invites whose (email→profile.id, course_id) has no enrollment row
   backfill = POST enrollments {user_id, course_id} with Prefer: resolution=merge-duplicates
   ```
   Full stranded list (16 on TLA 2026 `88450829-1694-480e-9afa-9bb44800bc47`; the 17th on Welcome
   `ed7e3fd0-…`): raffi@gmail.com, lilit.grigoryan@, lilit.khloyan@, mane.kirakosyan@, karlen.nazaryan@,
   hakob.varosyan@, mariam.aleksanyantfa@gmail.com, aleksanian.miriam@gmail.com, shushan.navasardyan@,
   ani.khachatryan@, stepanyan.mery@yahoo.com, manukyandranik@gmail.com, gevorgyanlilit864@gmail.com,
   yana@, vahehovsepyantfa@gmail.com, narine@ (all @teachforarmenia.org unless shown) + jvard.cash1@gmail.com
   (Welcome). Tatev (`ffd523ff-…`, Welcome) is ALREADY done.
3. **Verify WU-0005 migration (OQ-011)** — unchanged prior loop: service-role REST read
   `enrollments?select=status&limit=1` → `42703` if `enrollment_suspension.sql` not yet applied to prod.
4. **`git pull` before committing these doc updates** — local `main` lags `origin/main`.

### Gate recipe (verbatim)
```bash
npx tsc --noEmit                                    # fast type-check gate (clean this session)
NODE_OPTIONS="--max-old-space-size=8192" npm run build   # full build; default heap OOMs (SIGABRT)
```

## Recent decisions made
| When | Decision | Rationale / ref |
|---|---|---|
| 2026-08-17 | Fix only Tatev's data; leave the other 17 stranded learners un-backfilled | Operator call (AskUserQuestion); tracked as OQ-014 for a later batch decision |
| 2026-08-17 | Fix root cause + PR to `staging` (not straight to `main`) | Default-target-branch rule (CLAUDE.md); operator confirmed |
| 2026-08-17 | Extract shared `acceptPendingInvitations()` vs. fixing 3 copies inline | One correct sequencing in one place; matches `ensureProfile` helper pattern |
| 2026-08-17 | Branch off `origin/staging`, not `main` | staging is ahead (#280/#281 staff logic); a main-based branch would clobber it (trap #3) |

## Breadcrumbs / artifacts
- Scratch scripts in the session scratchpad (`…/scratchpad/q.sh`, `q.json`/`inv.json`/etc.) — the
  Supabase REST forensic queries + stranded-user diff. Ephemeral (temp dir clears); the reproducible
  logic is captured in §Immediate-next above. Keep-or-clean: **clean** (nothing durable beyond the recipe).
- **Prod data write this session:** 1 row — Tatev's enrollment (`user_id ffd523ff-116c-47fd-9080-
  36cd020a2955`, `course_id ed7e3fd0-11ea-4432-a52d-5cb6faaff2b7`, id `c77156d5-…`, status `active`).

## Reading order
1. This handoff. 2. `now/status.md` (delta). 3. `now/work-plan.md` (WU-0006 + Immediate-next).
4. `now/open-questions.md` (OQ-014 new; OQ-011 prior). 5. `CLAUDE.md` (auth/enrollment invariants +
deploy flow). No `checkpoints/` sitrep post-dates this handoff.

## Recent commits
- `origin/staging` head: `fba7a65` — fix: mark course invitation accepted only after enrollment succeeds (#283)
- `8f051b1` — feat: course-level learner suspension (#281)
- `ed5e15b` — feat: staff view courses without enrollment; exclude staff from progress stats (#280)
- local `main` head: `f6faca9` — release: security + content-protection fixes to production (#279) [behind origin]

---
*How to refresh this file: run `/handoff`.*
