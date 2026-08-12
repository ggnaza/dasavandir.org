---
id: LP-001
entry_type: lesson
provenance: llm-reviewed
template-version: 1.0.0
maturity: seedling
status: active
severity: medium
module: action
type: false-belief
tags: [git, gitignore, secrets, verification]
created: 2026-08-12
last-modified: 2026-08-12
last-applied: 2026-08-12
superseded-by: null
---

# A "no-diff" from `git diff <refA> <refB> -- <path>` is a FALSE all-clear when the path is untracked/ignored

## Question
Before committing tooling/config files, is a given path "the same" across branches — safe to reason
about as tracked?

## Claim (the lesson)
When checking whether a path is tracked or consistent across branches, run `git check-ignore -v <path>`
and `git ls-files <path>` FIRST — never infer it from `git diff <refA> <refB> -- <path>`. A commit-diff
shows **no difference when the path is absent from BOTH refs** (e.g. git-ignored), which reads as "SAME"
but actually means "not tracked at all." Trusting the false SAME can lead to force-adding an ignored
file.

## Evidence
2026-08-12 — during the Fieldbook install, `.claude/settings.json` reported "SAME on staging" via a
commit-diff, but `.gitignore:11` ignores all of `.claude/`; the file was untracked, and that directory
holds a plaintext GitHub token. Caught before any `git add -f` (log.md 2026-08-12).

## Trigger (when this fires)
Deciding whether to commit files under a config/tooling dir; any "is this path the same on X?" check;
seeing a suspiciously clean `git diff <ref> <ref> -- <path>`.

## Failure mode
Reasoning about an ignored path as if it were tracked → force-adding it → leaking a secret (or
committing machine-local config) that `.gitignore` was deliberately protecting.

## Mitigation / Action items
`git check-ignore -v <path>` and `git status`/`git ls-files` are the source of truth for tracked-ness.
Reserve `git diff <ref> <ref> -- <path>` for paths already confirmed tracked.
