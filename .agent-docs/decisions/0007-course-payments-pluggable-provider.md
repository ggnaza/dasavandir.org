---
provenance: llm-draft
status: proposed
template-version: 1.0.0
created: 2026-08-21
last-modified: 2026-08-21
work-unit: WU-0013
supersedes: []
superseded-by: null
related: [0004-multi-tenancy-organizations-spaces-shopify-model]
tags: [architecture, payments, enrollment, subscription, provider, feature-flag]
---

# ADR-0007 — Course payments: an order → checkout → enrol flow behind a pluggable, env-gated provider (mock now, real gateway later)

## Context
The operator wants paid courses to actually require payment: a buyer clicks pay, is taken to a payment
step (new page), pays, returns, and is enrolled. Subscriptions ("all courses, or the ones marked
available, via an active plan") are explicitly a **later** phase. Two hard constraints at build time:
1. **No payment gateway is chosen yet** (local VPOS/ArCa/Idram vs Stripe — Armenia-specific), and there
   are no credentials. So the *money step* can't be implemented, but the whole flow around it can.
2. **A pre-existing hole:** paid courses were self-enrollable **for free** via `/api/enrollments/enroll`
   (the free-enrol route only blocked `private`/`internal`, not `paid`).

Also surfaced: the `/courses` catalog was space-scoping signed-in users to their own spaces, **hiding
most published courses from registered users** — the opposite of a storefront.

## Alternatives Considered
- **Integrate a gateway now.** Rejected — no gateway decision and no credentials; would block the whole
  feature indefinitely.
- **Build the flow with a hardcoded "payments coming soon" stub, no test path.** Rejected — the flow
  couldn't be exercised end to end, and enrol-on-success couldn't be verified until a gateway existed.
- **Pluggable provider + a `mock` mode (chosen).** The flow (order → checkout → enrol) is
  provider-agnostic; a `mock` provider makes it fully testable on staging, and the real gateway drops
  into a documented seam without touching the plumbing. Env-gated so production stays safe.
- **Enrol-then-collect-payment vs pay-then-enrol.** Chose **pay-then-enrol**: an order is created
  `pending`, and enrolment happens only when the order is marked `paid`. Enrolling first and chasing
  payment risks free access on abandonment.
- **Catalog: keep space-scoping vs storefront-open.** Chose storefront-open for `public`/`paid` courses:
  they must be discoverable + purchasable by anyone. Space membership scopes *private/assigned* content
  and the learner's own course list, NOT public discovery. **This revises ADR-0004's catalog rule.**

## Decision
1. **Data:** `course_orders (user_id, course_id, org_id, amount_amd, status pending|paid|failed|cancelled,
   provider, provider_ref, paid_at)` + self-read RLS. Plus `courses.subscription_available boolean`
   (unused now — so the subscription phase needs no further migration). `payments_course_orders.sql`.
2. **Flow:** paid "Enrol" → `POST /api/payments/checkout` (creates a pending order, returns a checkout
   URL) → `/checkout/[orderId]` (a new page) → pay → order marked `paid` → **`lib/enroll.enrollUserInCourse`**
   (upsert enrolment + add to the course's space, identical to free enrol) → into the course. Login
   honours a relative `?next=` so unauth buyers return after signing in.
3. **Provider gate — `PAYMENTS_MODE` env (`lib/payments.ts`):**
   - `disabled` (**DEFAULT, prod-safe**) — pay button says "not available yet"; no order created. Paths
     are inert, so deploying with payments off breaks nothing (and the migration need not even be applied
     yet).
   - `mock` (**staging only**) — `/checkout` shows a "Pay (test)" button → `POST
     /api/payments/[orderId]/confirm` marks paid + enrols (no charge). The confirm route refuses unless
     mode is exactly `mock`, so it can never grant free access on prod.
   - `arca`/`stripe` (**future**) — implement `createCheckout()`/`verifyCallback()` + `/api/payments/callback`;
     the order/enrol plumbing is unchanged.
4. **Fixes the free-paid hole:** paid courses now route through checkout, not the free-enrol path.
5. **Subscription (later):** with an active subscription, grant access to courses where
   `subscription_available` (or all) — an entitlement check at the lesson-access gate + a subscriptions
   table. Not built.

## Consequences
- **Good:** the full flow is testable today (mock on staging) and gateway-ready (one seam). Prod is safe
  by default. Enrol-on-success is shared with free enrol, so behaviour is consistent.
- **Watch:** once deployed, **paid courses become non-enrollable until a gateway is configured** (they
  were wrongly free before). That is the intended direction, but it is a visible change — don't promote
  to prod expecting paid enrolments to work until `PAYMENTS_MODE` is a real provider.
- **Watch:** `PAYMENTS_MODE=mock` must NEVER be set on production (it would grant free enrolment). The
  confirm route's mode check is the backstop.
- **Migration hand-applied** (`memories/migrations-applied-by-hand.md`).

## Related
ADR-0004 (multi-tenancy; its catalog rule is revised here — public/paid courses are storefront-open, not
space-scoped); `lib/payments.ts` (the provider seam); WU-0013.
