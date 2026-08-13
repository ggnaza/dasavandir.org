---
id: LP-005
entry_type: lesson
provenance: llm-reviewed
template-version: 1.0.0
maturity: seedling
status: active
severity: medium
module: action
type: false-belief
tags: [nextjs, app-router, react, useState, client-component, gotcha]
created: 2026-08-13
last-modified: 2026-08-13
last-applied: 2026-08-13
superseded-by: null
---

# A client component's `useState` is NOT reset when `router.refresh()` re-renders the server parent — derive from props with a fallback

## Question
In a Next.js App Router client component whose data comes from a server parent, if I hold a selection in
`useState(initialFromProps)` and call `router.refresh()` after a mutation, will that state track the
refreshed props?

## Claim (the lesson)
No. `router.refresh()` re-runs the server component and passes **new props**, but the client component
instance is preserved — `useState(initial)` keeps its FIRST value and does not re-initialise from the new
prop. A selection stored that way can dangle: point at an item that no longer exists, or that didn't exist
at mount (e.g. a just-created entity). Don't trust `useState` to resync on refresh. Derive an **effective**
value from the current props with a fallback each render, and keep `useState` only for the user's explicit
override: `const effective = items.some(i => i.id === selected) ? selected : items[0]?.id`.

## Evidence
2026-08-13 (WU-0004, course phases) — `groups-manager.tsx` seeded `selectedPhase` from
`useState(phases[0]?.id ?? null)`. When a course's FIRST phase was created via the UI, `router.refresh()`
re-rendered with `phases=[TLA]` but `selectedPhase` stayed `null` → no tab active, group list filtered to
`phase_id === null` (empty), and a new group would be created unphased. Fixed by computing
`effectivePhase = phases.some(p=>p.id===selectedPhase) ? selectedPhase : phases[0].id` and using it for
filtering/creating; `setSelectedPhase` stays for explicit tab clicks. Caught in self-review, not runtime.

## Trigger (when this fires)
Editing a client component that (a) seeds `useState` from a prop, and (b) mutates server data then calls
`router.refresh()` (or otherwise expects new props to flow in) — dropdowns, tabs, selected-row state.

## Failure mode
Stale selection after a refresh: the UI shows nothing selected, filters to an empty/wrong set, or submits
against an id that no longer matches — silently, because the code "looks" reactive.

## Mitigation / Action items
Derive display/selection values from props each render with a fallback; reserve `useState` for the
user's explicit choice, and treat it as a hint, not the source of truth. Where a hard reset IS wanted on
prop change, use a `key` on the component so it remounts.
