---
id: LP-010
entry_type: lesson
provenance: llm-reviewed
template-version: 1.0.0
maturity: seedling
status: active
severity: high
module: action
type: false-belief
tags: [verification, testing, shell, gates, ci, reporting, gotcha]
created: 2026-09-07
last-modified: 2026-09-07
last-applied: 2026-09-07
superseded-by: null
---

# Capture a gate's exit status directly — never infer pass/fail from a truncated tail or a post-pipe `$?`

## Question
When reporting a build / type-check / test result, is reading the last few lines of its output — or
checking `$?` after piping it — good enough to say it passed?

## Claim (the lesson)
No, and both shortcuts **fail open**: they read as success when the gate actually failed.

- **`cmd | tail -N` can cut the failure summary.** Playwright's list reporter prints failures ABOVE the
  final count; a short tail shows `N passed` while an `N failed` line sits just off-screen.
- **`$?` after a pipe is the LAST stage's status, not the gate's.** `npx tsc --noEmit | head -20; echo $?`
  reports `head`'s exit code — always 0 — no matter how many type errors `tsc` found.

Do this instead:

```
cmd > /tmp/gate.log 2>&1; echo "exit: $?"   # status is the gate's own
tail -30 /tmp/gate.log                       # and read enough to see a summary
```

For test runners, prefer an explicit summary reporter (`--reporter=list`) and read the final
`N passed / N failed` line, not a fixed-size tail. If you are about to tell someone a gate is green,
the exit code must be something you actually captured.

## Evidence
2026-09-07 (Ararka session, WU-0014). Twice in one session:
1. Reported **"20 passed"**-style clean runs from `| tail -4`; a later `--reporter=list` re-run showed
   `5 failed` — the OAuth specs were failing `ERR_CONNECTION_REFUSED` against a dev server I had
   stopped. I had already told the operator the run was clean and had to correct it.
2. Ran `npx tsc --noEmit | head -20; echo "tsc exit: $?"` and `... ; echo "exit: $?"` several times,
   printing `0` while reporting `head`'s status. On the one occasion `tsc` genuinely failed (stale
   generated types under `.next/types`), the real error was visible only because it appeared inside
   `head`'s window.

## Trigger
About to state that a build, type-check, lint, or test run passed — or piping any gate's output.

## Failure mode
A green report on a red gate. Worse than a missed failure, because it actively stops the reader from
looking: work proceeds on top of a broken foundation, and the correction (when it comes) costs
credibility as well as time.

## Related
`now/lessons/proposals.md` (LP-007 — the sibling build-heap trap) · `now/handoff.md` §Anti-assumptions
