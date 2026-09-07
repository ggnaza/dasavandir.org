---
id: LP-012
entry_type: lesson
provenance: llm-reviewed
template-version: 1.0.0
maturity: seedling
status: active
severity: high
module: action
type: false-belief
tags: [environment, deployment, vercel, supabase, docs-decay, migrations, gotcha]
created: 2026-09-07
last-modified: 2026-09-07
last-applied: 2026-09-07
superseded-by: null
---

# Verify a doc's environment claims against the deployed artifact before acting on them

## Question
A handoff, README, or `.env.*` file tells me which database / project / service an environment uses. Is
that good enough to act on?

## Claim (the lesson)
No — not for anything irreversible. Environment documentation decays silently, and **a `.env.*` file in
a repo need not describe any real deployment**: Vercel (and most PaaS) read their own dashboard
variables and never look at the committed file. The deployed artifact is the authority.

For a Next.js app, `NEXT_PUBLIC_*` values are inlined at build time, so the shipped bundle states
exactly which backend a host talks to:

```
curl -s https://<host>/ -o page.html
for c in $(grep -o '/_next/static/chunks/[A-Za-z0-9._-]*\.js' page.html | sort -u); do
  curl -s "https://<host>$c"
done | grep -o 'https://[a-z0-9]*\.supabase\.co' | sort -u
```

Check server-side too — confirm the server client reads the same variable, so there is no second,
server-only target.

## Evidence
2026-09-07 (Ararka session, WU-0014). `now/handoff.md` (2026-08-21) stated staging DB =
`zzaiyqvlkdjiqnuluznl`, matching `.env.staging`. The deployed staging bundle actually inlines
`mmkmsudwtrqdzehnfctx` — **the production project**; both `staging.dasavandir.org` and
`www.dasavandir.org` use it, and the project named in `.env.staging` is read by no deployment at all.

Five Ararka migrations were applied to that unused project. The resulting missing `profiles.modules`
column then presented as something entirely unrelated — admins rendering as `learner` and being
redirected out of `/ararka` — because a Supabase `.select()` fails *whole* on one missing column. Cost:
most of a debugging session chasing an apparent auth bug.

## Trigger
Any doc-sourced belief about which backend an environment uses, immediately before a migration, a
destructive operation, or a "this is only staging" judgement.

## Failure mode
Irreversible work applied to the wrong system — or, as here, to no system at all, with the real symptom
surfacing far from the cause. Doubly dangerous when the doc is one you wrote yourself last session.

## Related
`memories/staging-shares-the-production-database.md` (the project-specific instance) · `OQ-015` ·
`memories/migrations-applied-by-hand.md`
