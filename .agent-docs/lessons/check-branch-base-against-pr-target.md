---
id: LP-004
entry_type: lesson
provenance: llm-reviewed
template-version: 1.0.0
maturity: seedling
status: active
severity: medium
module: action
type: process-gap
tags: [git, pr, branching, worktree]
created: 2026-08-13
last-modified: 2026-08-13
last-applied: 2026-08-13
superseded-by: null
---

# Check a branch's base against the PR target before opening the PR — a feature-based branch drags its feature into the PR

## Question
Is this branch safe to PR directly into the target, or will it carry unrelated commits?

## Claim (the lesson)
Run `git log <target>..HEAD --oneline` BEFORE `gh pr create`. If the branch was cut from a *feature*
branch (not from the target), the PR will include that feature's commits. Isolate the change onto a
target-based branch first — and a **worktree off `origin/<target>`** is the clean way to do it when the
main working tree has an untracked directory that would otherwise collide on `git checkout <target>`.

## Evidence
2026-08-13 (WU-0003) — `fix/rls-recursion-and-auth-hardening` was branched from
`feat/timetable-week-view`, so `git log origin/main..HEAD` showed `614abc3` (the unmerged timetable
feature). A direct PR to `main` would have bundled it. Created a worktree off `origin/main`
(`fix/rls-recursion-prod`), copied only the migration files in, and PR #271 was clean. The worktree also
sidestepped the untracked `.agent-docs/` checkout collision. (log.md 2026-08-13.)

## Trigger (when this fires)
About to `gh pr create` / push a branch for review; especially when the working branch was created off
something other than the PR target, or the working tree has untracked dirs that are tracked on the target.

## Failure mode
Open a PR that silently bundles an unrelated in-flight feature; merging it lands unreviewed feature work
on the target branch.

## Mitigation / Action items
`git log <target>..HEAD --oneline` before every PR. If it shows commits you don't own, rebase onto the
target or rebuild the change on a `git worktree add <path> origin/<target> -b <new-branch>` and copy in
only the intended files.
