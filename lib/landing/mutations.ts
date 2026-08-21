// Server-only: landing-page CMS writes (service-role admin client). ADR-0006 / WU-0012.
import DOMPurify from "isomorphic-dompurify";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrgId } from "@/lib/org";
import { blockList, type Block } from "./blocks";
import type { MenuLocation } from "./defaults";

export const RESERVED_SLUGS = new Set([
  "admin", "api", "auth", "learn", "courses", "terms", "privacy", "home", "_next", "public",
]);

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug) && slug.length <= 60;
}

export class LandingError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "LandingError";
  }
}

/** Sanitise admin-authored rich-text HTML in every richtext block before storing. */
function sanitizeBlocks(blocks: Block[]): Block[] {
  return blocks.map((b) => {
    if (b.type !== "richtext") return b;
    return {
      ...b,
      data: {
        ...b.data,
        html: {
          en: DOMPurify.sanitize(b.data.html.en),
          hy: DOMPurify.sanitize(b.data.html.hy),
        },
      },
    };
  });
}

interface Localized { en: string; hy: string }

export interface UpsertPageInput {
  slug: string;
  title: Localized;
  blocks: unknown;
  status: "draft" | "published";
  seo?: { title?: Localized; description?: Localized };
}

/**
 * Create-or-update a page by (org, slug). Used for the `home` system page
 * (created on first save) and every operator page. Validates blocks against the
 * schema and sanitises rich text. `is_system` is preserved / defaulted, never
 * settable by the caller.
 */
export async function upsertPage(input: UpsertPageInput): Promise<{ id: string; slug: string }> {
  const admin = createAdminClient();
  const orgId = await getCurrentOrgId(admin);
  if (!orgId) throw new LandingError("No organization", 500);

  if (!isValidSlug(input.slug)) throw new LandingError("Invalid slug");

  const parsed = blockList.safeParse(input.blocks);
  if (!parsed.success) throw new LandingError("Invalid blocks: " + parsed.error.issues[0]?.message);
  const blocks = sanitizeBlocks(parsed.data);

  const status = input.status === "published" ? "published" : "draft";
  const isSystem = input.slug === "home"; // home is the only seeded system page today

  const { data, error } = await admin
    .from("pages")
    .upsert(
      {
        org_id: orgId,
        slug: input.slug,
        title: input.title,
        blocks,
        status,
        seo: input.seo ?? {},
        is_system: isSystem,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,slug" },
    )
    .select("id, slug")
    .single();

  if (error) throw new LandingError(error.message, 500);
  return data;
}

/** Create a new empty draft page. Rejects reserved or duplicate slugs. */
export async function createPage(slug: string, title: Localized): Promise<{ id: string; slug: string }> {
  const admin = createAdminClient();
  const orgId = await getCurrentOrgId(admin);
  if (!orgId) throw new LandingError("No organization", 500);

  if (!isValidSlug(slug)) throw new LandingError("Slug must be lowercase letters, numbers and dashes");
  if (RESERVED_SLUGS.has(slug)) throw new LandingError(`"${slug}" is reserved`);

  const { data: existing } = await admin
    .from("pages").select("id").eq("org_id", orgId).eq("slug", slug).maybeSingle();
  if (existing) throw new LandingError("A page with that address already exists", 409);

  const { data, error } = await admin
    .from("pages")
    .insert({ org_id: orgId, slug, title, blocks: [], status: "draft", is_system: false })
    .select("id, slug")
    .single();

  if (error) throw new LandingError(error.message, 500);
  return data;
}

/** Delete an operator page. System pages (home) cannot be deleted. */
export async function deletePage(slug: string): Promise<void> {
  const admin = createAdminClient();
  const orgId = await getCurrentOrgId(admin);
  if (!orgId) throw new LandingError("No organization", 500);

  const { data: page } = await admin
    .from("pages").select("id, is_system").eq("org_id", orgId).eq("slug", slug).maybeSingle();
  if (!page) throw new LandingError("Page not found", 404);
  if (page.is_system) throw new LandingError("System pages cannot be deleted", 403);

  const { error } = await admin.from("pages").delete().eq("id", page.id);
  if (error) throw new LandingError(error.message, 500);
}

export interface MenuItemInput {
  location: MenuLocation;
  label: Localized;
  href: string;
  visible: boolean;
}

/**
 * Replace the entire menu for the org with the provided ordered list. Simplest
 * consistent model for a small menu: delete all + reinsert with sort_order = index.
 */
export async function replaceMenu(items: MenuItemInput[]): Promise<void> {
  const admin = createAdminClient();
  const orgId = await getCurrentOrgId(admin);
  if (!orgId) throw new LandingError("No organization", 500);

  for (const it of items) {
    if (it.location !== "nav" && it.location !== "footer") throw new LandingError("Invalid menu location");
  }

  const { error: delErr } = await admin.from("menu_items").delete().eq("org_id", orgId);
  if (delErr) throw new LandingError(delErr.message, 500);

  if (items.length === 0) {
    // Insert a single hidden sentinel so the org is marked "initialized" and the
    // public reader stops falling back to DEFAULT_MENU (deliberately empty menu).
    await admin.from("menu_items").insert({
      org_id: orgId, location: "footer", label: { en: "", hy: "" }, href: "", sort_order: 0, visible: false,
    });
    return;
  }

  const rows = items.map((it, i) => ({
    org_id: orgId,
    location: it.location,
    label: it.label,
    href: it.href,
    sort_order: i,
    visible: it.visible,
  }));
  const { error: insErr } = await admin.from("menu_items").insert(rows);
  if (insErr) throw new LandingError(insErr.message, 500);
}
