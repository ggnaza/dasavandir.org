---
provenance: llm-draft
created: 2026-07-03
last-modified: 2026-08-17
tags: [current, lessons, proposals, staging]
related: [MOC, ../../lessons/index]
---

# Lessons proposals — staging for human-gated promotion

The **staging area** for candidate lessons before they enter the ledger. The distillation pass appends
0–3 qualifying candidates here (`provenance: llm-draft`, `maturity: seedling`); `/handoff` walks each
one with the operator (**accept / defer / reject**). This file is the dedup baseline for the
distillation pass. **Nothing here is a lesson yet** — promotion to `../../lessons/<id>.md` is
human-gated.

> **Why a staging gate.** Same-model self-reflection collapses to confirmation bias without a human
> gate. "0 high-quality proposals" beats "3 weak ones" — a candidate that doesn't meet all four bars
> (concrete trigger · stable claim · evidence link · not-duplicate) is dropped, not padded.

## Staged candidates

- **LP-006** (seedling · llm-draft · surfaced 2026-08-14) — **When starting follow-up work right after
  merging a PR, branch off `origin/<base>`, not local `main`/`staging`.**
  - *Trigger:* beginning a new change immediately after merging a PR in the same session.
  - *Claim:* local branches lag the just-merged remote; editing on a stale local base silently drops the
    prior work and can produce a PR missing its own foundation.
  - *Evidence:* this session I edited `app/admin/courses/[id]/learners/page.tsx` on local `main`, then
    found the prior PR's `lib/filter-learner-ids.ts` wiring was absent (grep returned the pre-PR version);
    had to abandon and re-branch with `git checkout -b feat/… origin/staging`.

- **LP-007** (seedling · llm-draft · surfaced 2026-08-14) — **`next build` OOMs (SIGABRT) at default heap
  in this repo; use `tsc --noEmit` as the gate or `NODE_OPTIONS=--max-old-space-size=8192 npm run build`.**
  - *Trigger:* running the full production build locally to verify a change.
  - *Claim:* the type-check phase of `next build` exhausts the default V8 heap here (recurring across
    sessions, and now confirmed on a plain `main` checkout — NOT just a nested-worktree artifact as
    previously theorized). The reliable local gate is `tsc --noEmit`; a full build needs the heap bump.
  - *Evidence:* SIGABRT twice this session at default heap; clean compile + 115-route generation with
    `--max-old-space-size=8192`. Prior handoff mis-attributed it to worktree module resolution.
  - *Re-confirmed 2026-08-17 (WU-0006):* SIGABRT again at default heap on plain `main`/`staging` trees;
    heap bump compiled + generated all 115 routes cleanly. Third session running — strong promote signal.

- **LP-008** (seedling · llm-draft · surfaced 2026-08-17) — **A `gh pr merge` git error AFTER the API
  merge ("Not possible to fast-forward, aborting") does NOT mean the merge failed — verify PR state
  before reacting.**
  - *Trigger:* `gh pr merge --squash --delete-branch` prints a `fatal:`/`warning:` git error at the end.
  - *Claim:* `gh pr merge` performs the merge via the GitHub API first, then tries to update the LOCAL
    branch to match; when the local branch has diverged, that second step fails loudly — but the PR is
    already MERGED on the remote. Re-attempting the merge or "fixing" it risks confusion/duplication.
    Confirm with `gh pr view <n> --json state,mergedAt,mergeCommit` before doing anything.
  - *Evidence:* this session #283 printed "Not possible to fast-forward, aborting" yet
    `gh pr view 283` returned `state=MERGED, mergeCommit=fba7a65`; the fix was already on `origin/staging`.
  - *Note:* re-confirms LP-006 from the other direction — the local branch had diverged precisely because
    staging was ahead of main.

## Lifecycle

- **accept** → moved to `../../lessons/<id>.md`, gains a `lessons/index.md` entry (+ a `MOC.md` row if
  Tier-1/evergreen); removed from here.
- **defer** → stays here for the next `/handoff`.
- **reject** → removed, with a one-line reason logged to `../../log.md`.

## Maintenance

UPDATE-IN-PLACE; the distillation pass appends, `/handoff` drains. `last-modified` staleness is
lint-checked.
