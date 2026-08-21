import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { getLang } from "@/lib/i18n";
import { getPageForPublic, getMenu } from "@/lib/landing/store";
import { PublicPage } from "@/components/landing/public-page";

export const dynamic = "force-dynamic";

// Literal top-level routes always win over this catch-all in Next.js, but guard
// defensively so a CMS page can never shadow (or be shadowed by) a real route.
const RESERVED = new Set(["admin", "api", "auth", "learn", "courses", "terms", "privacy", "home"]);

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  if (RESERVED.has(params.slug)) return {};
  const page = await getPageForPublic(params.slug);
  if (!page) return {};
  const lang = getLang(cookies().get("lang")?.value);
  const title = page.seo?.title?.[lang] || page.title[lang] || page.title.en || undefined;
  const description = page.seo?.description?.[lang] || undefined;
  return { title, description };
}

export default async function CustomPage({ params }: { params: { slug: string } }) {
  if (RESERVED.has(params.slug)) notFound();

  const [page, nav, footer] = await Promise.all([
    getPageForPublic(params.slug),
    getMenu("nav"),
    getMenu("footer"),
  ]);

  if (!page) notFound();

  const lang = getLang(cookies().get("lang")?.value);
  return <PublicPage blocks={page.blocks} nav={nav} footer={footer} lang={lang} />;
}
