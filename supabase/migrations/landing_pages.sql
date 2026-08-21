-- Landing-page CMS — editable public marketing site (ADR-0006, WU-0012).
-- Additive and idempotent. Creates two org-scoped tables + a public image bucket.
-- NO content seed lives here: the initial homepage / nav / footer content is defined
-- in TypeScript (lib/landing/defaults.ts) and the DB rows are created lazily on first
-- save, so a page can never render blank and this migration carries no giant JSON literal.
-- Apply to STAGING first (Supabase SQL editor). Migrations are hand-applied
-- (memories/migrations-applied-by-hand.md). The app reads these via the service-role
-- client, so RLS is enabled with no authenticated policies (locked down).

-- 1. Pages — one row per public page (home, plus operator-created pages).
create table if not exists pages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  slug text not null,
  title jsonb not null default '{"en":"","hy":""}'::jsonb,   -- bilingual page title
  blocks jsonb not null default '[]'::jsonb,                 -- ordered array of block objects
  status text not null default 'draft',                      -- 'draft' | 'published'
  is_system boolean not null default false,                  -- home/terms/privacy: cannot be deleted
  seo jsonb not null default '{}'::jsonb,                     -- { title?, description? } bilingual
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, slug)
);

create index if not exists pages_org_id_idx on pages (org_id);

-- 2. Menu items — the public nav + footer links (this is how a new page is surfaced).
create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  location text not null,                                     -- 'nav' | 'footer'
  label jsonb not null default '{"en":"","hy":""}'::jsonb,    -- bilingual link label
  href text not null default '',                              -- path or absolute URL
  page_id uuid references pages(id) on delete set null,       -- optional link to a CMS page
  sort_order int not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists menu_items_org_loc_idx on menu_items (org_id, location, sort_order);

-- 3. RLS: enable; the app reads/writes via the service-role client (which bypasses RLS).
--    No authenticated policies — public content is served through server components.
alter table pages enable row level security;
alter table menu_items enable row level security;

-- 4. Public bucket for landing-page images (uploads via service-role; public read for display).
insert into storage.buckets (id, name, public)
values ('site', 'site', true)
on conflict (id) do nothing;
