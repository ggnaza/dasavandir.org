---
provenance: llm-reviewed
template-version: 1.0.0
created: 2026-08-12
last-modified: 2026-08-12
related: [architecture-overview]
tags: [ci, github-actions, agent, asana, disabled, operator-decision]
---

# The Asana "Build Agent" (`build-agent.yml`) is intentionally DISABLED — do not treat the scheduled workflow as live

**Observed:** `.github/workflows/build-agent.yml` is a scheduled (`cron: */30 * * * *`) GitHub Actions
workflow that polled Asana, picked up a task, and ran `claude --dangerously-skip-permissions -p ...`
(model `claude-sonnet-4-5`) to **implement the task in code** and stop before any git/PR. On 2026-08-12
the operator asked to switch it off; disabled via `gh workflow disable "Build Agent"` — state is now
`disabled_manually`. Its last several hourly scheduled runs before the disable were all **failing**
(cause not investigated — it was being turned off regardless).

**Root cause / note:** the workflow file still exists and still *declares* a schedule; "disabled" is a
GitHub-side toggle, NOT reflected in the repo files. Reading `build-agent.yml` alone would wrongly
suggest it's active.

**Workaround / fix:** to re-enable → `gh workflow enable "Build Agent"`. To make the OFF state visible
in code (survives accidental re-enable), open a PR commenting out the `schedule:` trigger — offered,
not yet done.

**Avoid:** don't assume the Asana→code pipeline is running. Don't re-enable without first investigating
why its runs were failing. The QA workflows (`qa.yml`, `qa-staging-pr.yml` — Playwright test runners)
are a SEPARATE concern and remain active.

**See also:** `.github/workflows/build-agent.yml`; `now/open-questions.md` OQ-005; log 2026-08-12.
