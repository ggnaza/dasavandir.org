---
provenance: llm-reviewed
template-version: 1.0.0
created: 2026-09-07
last-modified: 2026-09-07
related: [migrations-applied-by-hand, architecture-overview]
tags: [supabase, staging, deployment, vercel, database, trap, migrations]
---

# `staging.dasavandir.org` reads the PRODUCTION database — `.env.staging` does not describe any deployment

**Observed (2026-09-07):** `NEXT_PUBLIC_SUPABASE_URL` read out of the deployed JS bundles of both hosts
returns the same project for each:

- `www.dasavandir.org` → `mmkmsudwtrqdzehnfctx`
- `staging.dasavandir.org` → `mmkmsudwtrqdzehnfctx`

The separate project named in the repo's `.env.staging` (`zzaiyqvlkdjiqnuluznl`) is fully migrated but
its `profiles` table is **empty** and **no deployment reads it**. Vercel never reads `.env.staging` — it
uses its own dashboard environment variables, and the `dasavandir-org-h82a` project is configured with
the production Supabase URL.

Server-side agrees with the browser: `lib/supabase/admin.ts` and `lib/supabase/server.ts` both read
`NEXT_PUBLIC_SUPABASE_URL`, so there is no second, server-only project either.

## Why this matters

1. **A migration applied "for staging" hits production.** There is no separate staging schema to
   practise on.
2. **Testing on staging writes production data.** Rows created while click-testing are real.
3. **`.env.local` also points at `mmkmsudwtrqdzehnfctx`** — so local `npm run dev` is likewise talking to
   the production database.
4. **A doc that says otherwise will cost you an afternoon.** The 2026-08-21 handoff asserted
   staging = `zzaiyqvlkdjiqnuluznl`; acting on it sent five Ararka migrations to a database nothing
   reads, and the resulting missing column presented as an unrelated-looking auth bug (admins rendering
   as learners).

## How to check, rather than trust a doc

```
curl -s https://<host>/ -o page.html
for c in $(grep -o '/_next/static/chunks/[A-Za-z0-9._-]*\.js' page.html | sort -u); do
  curl -s "https://<host>$c"
done | grep -o 'https://[a-z0-9]*\.supabase\.co' | sort -u
```

`NEXT_PUBLIC_*` values are inlined at build time, so the deployed bundle is the authority on which
project a host actually uses — not any file in the repo.

## Status

Structural fix (give staging a real, seeded database, or accept the risk in writing) is tracked as
**`OQ-015`**. Until then, treat every "staging" migration and every staging click-test as production.

## Second instance of the same trap (2026-09-07, later)

The module-access + Gnahatum work repeated it exactly. Both migrations
(`efficacy_schema.sql`, `module_access.sql`) were applied to
`zzaiyqvlkdjiqnuluznl` because it is the project named in `.env.staging` and is
the one the phrase "the staging Supabase" naturally points at. Re-verified from
the deployed bundle that `staging.dasavandir.org` still reads
`mmkmsudwtrqdzehnfctx`; the migrated project has 0 auth users and 0 profiles,
the read project has 210 profiles and neither `module_access` nor `is_ldm`.

**Rule of thumb:** before handing over any migration, state the project *ref*
(`mmkmsudwtrqdzehnfctx`), never the word "staging". The word is ambiguous here
and the ambiguity has now cost two sessions.

## Related: the module subdomains are on the wrong Vercel deployment

`staging.efficacy.dasavandir.org` and `staging.gnahatum.dasavandir.org` return
200 on `/` but **404 on every application route** (`/efficacy`, `/gnahatum`,
`/ararka`), while `staging.dasavandir.org` serves all of them correctly. They
are attached to something other than the staging-branch build, so `middleware.ts`
never sees those hosts and the subdomain rewrite cannot fire — no code change
can fix it. The path form (`staging.dasavandir.org/gnahatum`) is the working
surface until the domains are re-pointed in the Vercel dashboard.
