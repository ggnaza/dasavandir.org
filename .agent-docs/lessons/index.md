---
provenance: kit-template
created: 2026-07-03
last-modified: 2026-08-13
tags: [meta, index, routing, lessons]
related: [CONVENTIONS]
---

# lessons/ — routing catalog

Typed, append-only lessons-learned ledger. **Read before action.** The full ledger lives here; the
bounded auto-loaded surface is `now/lessons/MOC.md` (the Tier-1 MOC, ~30 entries) — this index never
replaces the MOC. Schema authority: `../CONVENTIONS.md` (lesson template).

> **Why a typed ledger.** Every durable rule is the fossil of a real, recurrence-counted incident.
> Without typing + a decay signal + a human promotion gate, lessons either re-learn themselves each
> time or drown the signal in noise.

## Entry purpose + naming

- **Purpose:** an atomic, evidence-linked lesson or near-miss — "when X, do Y, because Z."
- **Filename:** `lessons/<kebab-slug-of-claim>.md`; superseded entries → `lessons/archive/`.
- **Write-discipline:** APPEND-ONLY (`status:` may change to `superseded`/`deprecated`/`quarantined`).

## Entry SCHEMA (front-matter axes + body)

- Front-matter: `entry_type` (lesson | near-miss) × `provenance` × `maturity` (seedling → budding →
  evergreen) × `status` × `severity` × `module` × `type`.
- Body: Question · Claim · Evidence (a log timestamp / commit / ADR / incident — required past
  seedling) · Trigger · Failure mode (or "What almost happened" + "What made the save reliable" for a
  near-miss) · Mitigation · Recurrence count.

## Quarantine (model/harness-bound lessons)

A lesson true only of a specific model or tool-era gets `status: quarantined` and lives in a
quarantine sub-section — kept for genealogy, NOT auto-loaded into the Tier-1 MOC.

## Promotion (always human-gated)

The distillation pass drafts candidates → `now/lessons/proposals.md` → promoted at `/handoff`.
Maturity `seedling → budding → evergreen`; prune `last-applied > 90d` → `lessons/archive/`. An
accepted lesson gets BOTH a `lessons/index.md` entry (here) AND a possible MOC row. Severity /
cost-of-recurrence can justify promotion on first sighting — it need not wait for the 3rd recurrence.

## Lessons

- `git-diff-no-diff-false-on-ignored-path.md` (LP-001) — **Open when:** deciding whether to commit
  files under a config/tooling dir, or checking if a path is "the same" across branches.
  **Carry-away:** verify tracked-ness with `git check-ignore`/`git ls-files` — a `git diff <ref> <ref>
  -- <path>` shows no-diff for an ignored path, a false SAME that can lead to leaking a secret.
  *(seedling · medium · action.)*
- `committing-untracked-files-hides-them-on-branch-switch.md` (LP-002) — **Open when:** untracked files
  vanish after switching back from a branch you committed them onto. **Carry-away:** that's normal
  (tracked-there, absent-here); restore with `git restore --source=<branch> --worktree -- <path>`.
  *(seedling · low · action.)*
- `verify-live-pg-policies-before-policy-migration.md` (LP-003) — **Open when:** writing/applying ANY
  migration to a hand-applied Supabase DB (RLS/policy/trigger OR a plain `ALTER`/FK), or "same fix, now
  on prod." **Carry-away:** the repo's `migrations/` ≠ live and staging ≠ prod; verify the live schema per
  target FIRST — a `DROP POLICY IF EXISTS "<name>"` silently no-ops if the live name differs, AND an env
  may be missing whole tables/features (`42P01`) — check `information_schema.tables` before referencing
  them. *(seedling · high · action; broadened 2026-08-13 from policies to any migration.)*
- `check-branch-base-against-pr-target.md` (LP-004) — **Open when:** about to `gh pr create` / push a
  branch for review. **Carry-away:** run `git log <target>..HEAD` first; a branch cut from a feature
  branch drags that feature in — isolate onto a target-based branch (a worktree off `origin/<target>`
  also sidesteps untracked-dir checkout collisions). *(seedling · medium · action.)*
- `client-usestate-not-reset-on-router-refresh.md` (LP-005) — **Open when:** editing a Next.js App Router
  client component that seeds `useState` from a prop and calls `router.refresh()` after a mutation.
  **Carry-away:** `useState` is NOT re-initialised when refresh passes new props — derive an *effective*
  value from props with a fallback (`items.some(i=>i.id===sel)?sel:items[0]?.id`) and keep state only for
  the explicit override; or `key` the component to force remount. *(seedling · medium · action.)*
- `adding-a-role-means-grepping-every-enum-validation-site.md` (LP-009) — **Open when:** adding a new
  `role` (or any string enum used across the app). **Carry-away:** a role/enum is validated in MORE than
  the UI toggle + DB CHECK — every write endpoint's `z.enum([...])` (create AND update are different
  routes) AND any `.in("role",[...])` read filter. `tsc` can't catch a missed one (the string is valid
  TS); it fails at runtime as a 400/empty-list. `grep -rn` the enum members across `app/api` before
  merging. *(seedling · medium · action.)*

## Maintenance

APPEND-ONLY; adding/retiring a lesson updates this index in the same change. Carry-away claims must
be traceable to the source lesson — a wrong carry-away is worse than none.
