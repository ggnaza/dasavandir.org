---
id: LP-002
entry_type: lesson
provenance: llm-reviewed
template-version: 1.0.0
maturity: seedling
status: active
severity: low
module: action
type: false-belief
tags: [git, branches, worktree]
created: 2026-08-12
last-modified: 2026-08-12
last-applied: 2026-08-12
superseded-by: null
---

# Committing untracked files onto a NEW branch removes them from the branch you switch back to

## Question
After isolating untracked work (e.g. `.agent-docs/`) onto a fresh branch and committing it there, why
did the files vanish from the original branch's working folder on switch-back?

## Claim (the lesson)
Once untracked files are committed on branch B, they are **tracked-on-B and absent-on-A**; `git
checkout A` deletes them from the working tree (A has no such commit). To keep them present in A's
working folder without staging them there, restore from B:
`git restore --source=B --worktree -- <path>`.

## Evidence
2026-08-12 — `.agent-docs/` disappeared from the working folder on switching from
`chore/fieldbook-context-store` back to `feat/timetable-week-view`; restored via
`git restore --source=chore/fieldbook-context-store --worktree -- .agent-docs` (log.md 2026-08-12).

## Trigger (when this fires)
Committing previously-untracked files onto a new branch based off a different base, then `git checkout`
back to the original branch and finding the files gone.

## Failure mode
Momentary "my work is lost" panic, or a redundant re-generation of files that are actually safe on the
other branch.

## Mitigation / Action items
Expect the disappearance; it's normal. Recover with `git restore --source=<branch> --worktree -- <path>`
(worktree-only, does not stage). The files remain safe in the branch/PR that has the commit.
