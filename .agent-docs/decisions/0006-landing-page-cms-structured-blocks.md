---
provenance: llm-draft
status: proposed
template-version: 1.0.0
created: 2026-08-21
last-modified: 2026-08-21
work-unit: WU-0012
supersedes: []
superseded-by: null
related: [0004-multi-tenancy-organizations-spaces-shopify-model]
tags: [architecture, cms, landing-page, marketing, blocks, i18n]
---

# ADR-0006 — The public marketing site is edited from the admin via a *structured block editor*, not a freeform drag-and-drop canvas

## Context
The operator wants to edit the public landing page (and other public/marketing pages) from the admin
panel — text, blocks, images, order — "maybe drag and drop." Today the homepage (`app/home-client.tsx`)
is hardcoded JSX whose copy comes from `lib/i18n.ts` in **two languages (en/hy)**; `/terms` and `/privacy`
are hardcoded bilingual legal documents. There is no content table. The operator also wants to **add new
pages** and link them in the nav or footer.

Constraints that shape the choice:
1. **Bilingual is mandatory** — every editable string exists in en + hy. This doubles every text field and
   is a first-class part of the schema, not an afterthought.
2. **On-brand + responsive must survive editing.** The current page has a deliberate structure
   (Hero → Stats → Features → CTA → Footer) and a fixed brand palette. A non-technical editor must not be
   able to produce an off-brand or mobile-broken page.
3. **Multi-tenant is live** (ADR-0004: orgs + spaces). Content must be `org_id`-scoped from day one so
   per-org landing pages come free in Phase 2, even though there is one org today.
4. **Existing seams to reuse:** the `settings` key/value table + `/api/admin/settings` (JSON config
   precedent), the public `avatars` Storage bucket (upload precedent), TipTap (already a dependency —
   rich-text is a solved problem here), and `requireRole(admin, …, ADMIN_ROLES)` for guarding.
5. **Legal pages carry legal weight.** A fat-finger edit to Terms/Privacy has real consequences, and the
   400-line bilingual legal markup is costly and error-prone to migrate into an editor format.

## Decision
Build a **structured block (section) editor**, org-scoped:

- **`pages`** table — `id, org_id, slug, title(jsonb {en,hy}), blocks(jsonb), status(draft|published),
  is_system(bool), seo(jsonb), updated_at`. `blocks` is an ordered array of
  `{ id, type, visible, data }`; each `data` holds per-language text `{en,hy}`, image URLs, colors, links.
- **`menu_items`** table — `id, org_id, location('nav'|'footer'), label(jsonb {en,hy}), href, page_id?,
  sort_order, visible`. Drives the public nav + footer; this is how a newly-created page is surfaced.
- A new public **`site`** Storage bucket for uploaded block images.
- **Block catalog v1:** `hero`, `stats`, `features`, `richtext` (TipTap), `image`, `cta`. A fixed catalog —
  the editor reorders (drag via `@dnd-kit`), toggles, adds, and removes catalog blocks and edits their
  fields. It does **not** allow arbitrary element placement.
- **Public rendering:** a `<BlockRenderer>` maps block-type → a brand-fixed React component (the current
  homepage sections, extracted). `app/page.tsx` renders the seeded `home` page from the DB; a new
  `app/[slug]/page.tsx` catch-all renders custom pages; nav/footer read `menu_items`. Every surface falls
  back to seeded defaults so a page can never render blank.
- **Seeding (zero regression):** the default homepage content + nav/footer live in TypeScript
  (`lib/landing/defaults.ts`), reproduce today's page exactly, and are the fallback until a DB row is
  saved. The migration creates only tables + bucket — no content JSON literal to paste.
- **Terms/Privacy stay as code initially**, but appear in the nav/footer manager (relabel/reorder/hide).
  Converting their legal text into editable `richtext` blocks is a deferred follow-up (see Consequences).
- **Guarding:** all mutating APIs under `/api/admin/pages` + `/api/admin/menu` require `ADMIN_ROLES`.

## Alternatives Considered
- **Freeform drag-and-drop canvas** (Webflow/Puck-style — the operator's first phrasing). Rejected: the
  bilingual requirement makes per-element freeform editing painful, it lets a non-technical editor produce
  off-brand / mobile-broken layouts (violates constraint 2), and it is a large, fragile surface (a schema,
  a serializer, a canvas renderer, responsive handling) to build and maintain. Flip-condition: if the site
  ever needs genuinely bespoke per-page layouts beyond a section catalog, revisit — but that is not the ask.
- **Simple fixed-field editor, no reordering** (edit the current sections' text/images only). Rejected as
  under-delivering: the operator explicitly wants to add/reorder blocks and add whole pages. Kept as the
  effective *fallback behaviour* though — with one seeded page and no reordering it degrades to exactly this.
- **Store everything in one `settings` JSON blob** (reuse the existing key/value table). Rejected: multiple
  pages + per-page status + a menu need real rows, indexes, and an `org_id` FK; a single blob has no
  per-page addressing and fights the multi-tenant scoping. The `settings` table stays for its scalar config.
- **Migrate Terms/Privacy into the CMS now** (literal reading of "all public pages"). Deferred, not
  rejected: the CMS *is* built capable of rich-text pages, but converting live bilingual legal copy on day
  one is high-risk for low value. Offered as a follow-up once the editor is trusted.
- **Add a heavyweight headless CMS** (Sanity/Strapi/Payload). Rejected: a new external service + auth +
  hosting for what is a handful of tables the app already has all the primitives for; also splits the
  content out of the multi-tenant DB the rest of the app relies on.

## Consequences
- **Good:** on-brand by construction; bilingual native; reuses `settings`/Storage/TipTap/`requireRole`
  patterns; `org_id`-scoped so Phase-2 per-org storefronts inherit it; homepage becomes DB-backed with
  zero visual change; new pages + nav/footer links are self-serve.
- **Cost / follow-ups:**
  - Adds one runtime dependency (`@dnd-kit`) for reordering — currency-checked before pin.
  - Migrations are hand-applied by the operator (`memories/migrations-applied-by-hand.md`); the migration
    is table-only (no content), and the TS defaults reproduce the current homepage exactly so nothing
    regresses before the first save.
  - The homepage becomes a DB read on an anonymous route — must stay fast (single row) and fall back to a
    hardcoded default if the row is absent (defensive, mirrors the CLAUDE.md profile-read discipline).
  - **DEFER-1:** Terms/Privacy remain code until a follow-up converts them to `richtext` pages.
  - **DEFER-2:** the block catalog is fixed at v1; new block types are code changes (a registry keeps that
    a one-file addition).
- Resolves the "edit the landing page from admin" request as **WU-0012**. Phase-2 per-org landing pages
  (ADR-0004) build directly on the `org_id` scoping introduced here.
