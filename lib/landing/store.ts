// Server-only: uses the service-role admin client. Never import into a client component.
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrgId } from "@/lib/org";
import { blockList, type Block } from "./blocks";
import { DEFAULT_HOME_BLOCKS, DEFAULT_MENU, type MenuItem, type MenuLocation } from "./defaults";

/**
 * Server-side data access for the landing-page CMS (ADR-0006).
 * All reads are scoped to the current org and use the service-role client
 * (landing content is org-wide public data; RLS on these tables is admin-only).
 */

export interface PageSeo {
  title?: { en: string; hy: string };
  description?: { en: string; hy: string };
}

export interface PageRecord {
  id: string;
  slug: string;
  title: { en: string; hy: string };
  blocks: Block[];
  status: "draft" | "published";
  is_system: boolean;
  seo: PageSeo;
  updated_at: string;
}

interface RawPageRow {
  id: string;
  slug: string;
  title: unknown;
  blocks: unknown;
  status: string;
  is_system: boolean;
  seo: unknown;
  updated_at: string;
}

function parseBlocks(raw: unknown, fallback: Block[]): Block[] {
  const res = blockList.safeParse(raw);
  return res.success ? res.data : fallback;
}

function asLocalized(raw: unknown): { en: string; hy: string } {
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    return { en: typeof o.en === "string" ? o.en : "", hy: typeof o.hy === "string" ? o.hy : "" };
  }
  return { en: "", hy: "" };
}

function toRecord(row: RawPageRow, blockFallback: Block[]): PageRecord {
  return {
    id: row.id,
    slug: row.slug,
    title: asLocalized(row.title),
    blocks: parseBlocks(row.blocks, blockFallback),
    status: row.status === "published" ? "published" : "draft",
    is_system: !!row.is_system,
    seo: row.seo && typeof row.seo === "object" ? (row.seo as PageSeo) : {},
    updated_at: row.updated_at,
  };
}

const PAGE_COLUMNS = "id, slug, title, blocks, status, is_system, seo, updated_at";

/**
 * Read a page for PUBLIC rendering. Returns null when the page should 404
 * (unknown slug, or draft). The `home` slug always resolves — it falls back to
 * DEFAULT_HOME_BLOCKS when there is no published row yet, so it can never 404.
 */
export async function getPageForPublic(slug: string): Promise<PageRecord | null> {
  const admin = createAdminClient();
  const orgId = await getCurrentOrgId(admin);

  if (orgId) {
    const { data } = await admin
      .from("pages")
      .select(PAGE_COLUMNS)
      .eq("org_id", orgId)
      .eq("slug", slug)
      .maybeSingle();

    if (data) {
      const rec = toRecord(data as RawPageRow, slug === "home" ? DEFAULT_HOME_BLOCKS : []);
      if (rec.status === "published") return rec;
      // Draft: public gets nothing (home still falls back below).
    }
  }

  if (slug === "home") return syntheticHome();
  return null;
}

function syntheticHome(): PageRecord {
  return {
    id: "default-home",
    slug: "home",
    title: { en: "Home", hy: "Գլխավոր" },
    blocks: DEFAULT_HOME_BLOCKS,
    status: "published",
    is_system: true,
    seo: {},
    updated_at: new Date(0).toISOString(),
  };
}

/** List every page for the admin (all statuses), system pages first then newest-updated. */
export async function listPages(): Promise<PageRecord[]> {
  const admin = createAdminClient();
  const orgId = await getCurrentOrgId(admin);
  if (!orgId) return [];

  const { data } = await admin
    .from("pages")
    .select(PAGE_COLUMNS)
    .eq("org_id", orgId)
    .order("is_system", { ascending: false })
    .order("updated_at", { ascending: false });

  return (data ?? []).map((r) => toRecord(r as RawPageRow, []));
}

/**
 * Read one page for the ADMIN editor by slug. If the slug is the `home` system
 * page with no row yet, returns a synthetic record seeded from defaults so the
 * editor opens with today's content; the row is created on first save.
 */
export async function getPageForEdit(slug: string): Promise<PageRecord | null> {
  const admin = createAdminClient();
  const orgId = await getCurrentOrgId(admin);
  if (!orgId) return null;

  const { data } = await admin
    .from("pages")
    .select(PAGE_COLUMNS)
    .eq("org_id", orgId)
    .eq("slug", slug)
    .maybeSingle();

  if (data) return toRecord(data as RawPageRow, slug === "home" ? DEFAULT_HOME_BLOCKS : []);
  if (slug === "home") return syntheticHome();
  return null;
}

// ── Menu (nav + footer) ─────────────────────────────────────────────────────

interface RawMenuRow {
  id: string;
  location: string;
  label: unknown;
  href: string;
  sort_order: number;
  visible: boolean;
}

function toMenuItem(row: RawMenuRow): MenuItem {
  return {
    id: row.id,
    location: row.location === "footer" ? "footer" : "nav",
    label: asLocalized(row.label),
    href: row.href,
    visible: !!row.visible,
  };
}

const MENU_COLUMNS = "id, location, label, href, sort_order, visible";

async function fetchMenuRows(): Promise<MenuItem[] | null> {
  const admin = createAdminClient();
  const orgId = await getCurrentOrgId(admin);
  if (!orgId) return null;

  const { data } = await admin
    .from("menu_items")
    .select(MENU_COLUMNS)
    .eq("org_id", orgId)
    .order("sort_order", { ascending: true });

  const rows = data ?? [];
  if (rows.length === 0) return null; // never initialized → caller uses defaults
  return rows.map((r) => toMenuItem(r as RawMenuRow));
}

/**
 * Read menu items for one location, in order. Falls back to DEFAULT_MENU only
 * when the org has never initialized any menu items — once any row exists, the
 * stored menu is authoritative, including a deliberately empty location.
 */
export async function getMenu(location: MenuLocation): Promise<MenuItem[]> {
  const items = await fetchMenuRows();
  if (!items) return DEFAULT_MENU.filter((m) => m.location === location);
  return items.filter((m) => m.location === location);
}

/** All menu items (both locations) for the admin editor, ordered. */
export async function listMenu(): Promise<MenuItem[]> {
  const items = await fetchMenuRows();
  return items ?? DEFAULT_MENU;
}
