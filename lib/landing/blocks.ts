import { z } from "zod";

/**
 * Landing-page block schema (ADR-0006).
 *
 * The public marketing site is a set of `pages`, each an ordered list of blocks.
 * A block is `{ id, type, visible, data }`; `data` shape depends on `type`.
 * All user-facing copy is bilingual (`{ en, hy }`) — this is a hard requirement.
 *
 * These TypeScript defaults (DEFAULT_HOME_BLOCKS / DEFAULT_MENU) are the single
 * source of truth for the *initial* content. The DB `pages`/`menu_items` rows are
 * created lazily on first save, and the public renderer falls back to these
 * defaults when a row is absent — so a page can never render blank and the
 * migration carries no giant JSON literal.
 */

// ── Primitives ──────────────────────────────────────────────────────────────

/** A bilingual string. Both languages are always present (may be empty). */
export const localized = z.object({ en: z.string(), hy: z.string() });
export type Localized = z.infer<typeof localized>;

/** A hex colour (`#RGB` or `#RRGGBB`) — guards values interpolated into `style`. */
export const hexColor = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Must be a hex colour like #EC5328");

/** A link target: an internal path or an absolute http(s) URL. Guards `href`. */
export const linkHref = z
  .string()
  .regex(/^(\/[^\s]*|https?:\/\/[^\s]+|mailto:[^\s]+)$/, "Must be a path or http(s) URL")
  .or(z.literal(""));

/** A button action: open the signup/login modal, or navigate to a link. */
export const buttonAction = z.enum(["signup", "login", "link"]);
export type ButtonAction = z.infer<typeof buttonAction>;

export const button = z.object({
  label: localized,
  action: buttonAction,
  href: linkHref.default(""),
});
export type Button = z.infer<typeof button>;

// ── Block data schemas ──────────────────────────────────────────────────────

export const heroData = z.object({
  tag: localized,
  title: localized,
  titleAccent: localized,
  desc: localized,
  primary: button,
  secondary: button,
  bgColor: hexColor.default("#323131"),
  accentColor: hexColor.default("#EC5328"),
});

export const statsData = z.object({
  bgColor: hexColor.default("#2085C7"),
  items: z
    .array(z.object({ number: localized, label: localized }))
    .max(8),
});

export const featuresData = z.object({
  title: localized,
  subtitle: localized,
  bgColor: hexColor.default("#E8E7E5"),
  cards: z
    .array(
      z.object({
        icon: z.string().max(8),
        title: localized,
        desc: localized,
        color: hexColor.default("#EC5328"),
      }),
    )
    .max(12),
});

export const ctaData = z.object({
  title: localized,
  desc: localized,
  button: button,
  bgColor: hexColor.default("#EC5328"),
});

/** Rich text authored per-language in TipTap; stored as sanitised HTML strings. */
export const richtextData = z.object({
  html: localized,
  bgColor: hexColor.default("#FFFFFF"),
});

export const imageData = z.object({
  src: z.string().url().or(z.literal("")),
  alt: localized,
  caption: localized,
  width: z.enum(["full", "contained"]).default("contained"),
});

// ── Block union ─────────────────────────────────────────────────────────────

const blockBase = { id: z.string().min(1), visible: z.boolean().default(true) };

export const block = z.discriminatedUnion("type", [
  z.object({ ...blockBase, type: z.literal("hero"), data: heroData }),
  z.object({ ...blockBase, type: z.literal("stats"), data: statsData }),
  z.object({ ...blockBase, type: z.literal("features"), data: featuresData }),
  z.object({ ...blockBase, type: z.literal("cta"), data: ctaData }),
  z.object({ ...blockBase, type: z.literal("richtext"), data: richtextData }),
  z.object({ ...blockBase, type: z.literal("image"), data: imageData }),
]);
export type Block = z.infer<typeof block>;
export type BlockType = Block["type"];

export const blockList = z.array(block);

// ── Catalog (drives the editor's "add block" menu) ──────────────────────────

export const BLOCK_CATALOG: { type: BlockType; label: string; icon: string; hint: string }[] = [
  { type: "hero", label: "Hero", icon: "🎯", hint: "Big headline, subtext, and call-to-action buttons." },
  { type: "stats", label: "Stats bar", icon: "📊", hint: "A row of numbers with labels." },
  { type: "features", label: "Features grid", icon: "✦", hint: "A grid of feature cards with icons." },
  { type: "richtext", label: "Rich text", icon: "📝", hint: "Free-form formatted text (headings, lists, links)." },
  { type: "image", label: "Image", icon: "🖼️", hint: "A single image with optional caption." },
  { type: "cta", label: "Call to action", icon: "📣", hint: "A centred banner with one button." },
];

// ── Factory: a fresh block of a given type with sensible empty defaults ──────

const empty: Localized = { en: "", hy: "" };

/** Build a new, empty block. `id` should be a fresh unique id (e.g. crypto.randomUUID()). */
export function newBlock(type: BlockType, id: string): Block {
  switch (type) {
    case "hero":
      return {
        id, type, visible: true,
        data: {
          tag: { ...empty }, title: { ...empty }, titleAccent: { ...empty }, desc: { ...empty },
          primary: { label: { en: "Get started", hy: "Սկսել" }, action: "signup", href: "" },
          secondary: { label: { en: "Sign in", hy: "Մուտք" }, action: "login", href: "" },
          bgColor: "#323131", accentColor: "#EC5328",
        },
      };
    case "stats":
      return { id, type, visible: true, data: { bgColor: "#2085C7", items: [{ number: { ...empty }, label: { ...empty } }] } };
    case "features":
      return {
        id, type, visible: true,
        data: { title: { ...empty }, subtitle: { ...empty }, bgColor: "#E8E7E5", cards: [{ icon: "✦", title: { ...empty }, desc: { ...empty }, color: "#EC5328" }] },
      };
    case "cta":
      return { id, type, visible: true, data: { title: { ...empty }, desc: { ...empty }, button: { label: { en: "Get started", hy: "Սկսել" }, action: "signup", href: "" }, bgColor: "#EC5328" } };
    case "richtext":
      return { id, type, visible: true, data: { html: { ...empty }, bgColor: "#FFFFFF" } };
    case "image":
      return { id, type, visible: true, data: { src: "", alt: { ...empty }, caption: { ...empty }, width: "contained" } };
  }
}
