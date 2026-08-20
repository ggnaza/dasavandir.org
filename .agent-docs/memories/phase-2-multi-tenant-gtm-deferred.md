---
provenance: llm-draft
template-version: 1.0.0
created: 2026-08-20
last-modified: 2026-08-20
related: [migrations-applied-by-hand]
tags: [multi-tenancy, deferred, roadmap, billing, domains, phase-2]
---

# Multi-tenancy Phase 2 (the go-to-market machinery) is DEFERRED — build the Phase 0 backbone + Phase 1 spaces now, come back to Phase 2 only when onboarding the first external customer

**Decision (ADR-0004, 2026-08-20):** multi-tenancy splits into a cheap-but-foundational backbone and an
expensive go-to-market layer. Build the backbone (Phase 0) + the internal spaces feature (Phase 1) now;
**explicitly defer everything else to Phase 2** until there is a real external paying customer.

**Phase 2 — what is deliberately NOT being built now (come back to this list):**
- **Console/storefront domain split** — authoring at `admin.<domain>`, learning at the storefront.
- **Tenant-resolution middleware** — resolve `org_id` from the request hostname (subdomain / custom
  domain map); until then there is exactly one org (AEI) and `auth_org()` is effectively constant.
- **Default storefront subdomains** on a **neutral base domain** (the `myshopify.com` equivalent) — NOT
  under `dasavandir.org` (which is itself just one tenant's brand).
- **Custom domains + cross-apex SSO token hand-off** — a session cookie cannot cross apex domains, so
  central-login → `admin.<customdomain>` needs a short-lived one-time-token exchange. Within one base
  domain a shared parent-domain cookie suffices.
- **Per-org storefront editor** — extends the existing "homepage editing admin section" backlog item
  from one site to one-per-org (MVP = structured fields: logo, colour, hero, featured courses, about).
- **Org self-signup + provisioning** — a company creates its own org, or AEI provisions one and hands
  it over.
- **Subscription billing + discount coupons (Case A, B2B)** — plan + seats billed at the org level;
  admin-generated coupons with redemption history. (Separate from Case B learner course purchases.)
- **White-label** — remove platform branding, branded emails + certificates.

**Why deferred:** none of it is needed for AEI's own use (single org, one domain). Phases 0+1 already lay
the seam (org_id + RLS + org_members + spaces + a per-org `canonical_domain` field), so Phase 2 is
**additive**, not a rebuild.

**Two open sub-decisions to settle before Phase 2 (do NOT block Phase 0/1):**
1. Register a **neutral base domain** now vs. later (cheap now, painful to retrofit if selling widely).
2. Who **collects the money** when a learner pays inside another org's storefront — platform-collects-
   and-splits (marketplace) vs. org-brings-its-own-gateway.

**See also:** ADR-0004; the flow artifact "dasavandir Tenancy Flows"; WU-0007 (Phase 0), WU-0008
(Phase 1); `memories/migrations-applied-by-hand.md`.
