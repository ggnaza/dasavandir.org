"use client";

import Link from "next/link";
import type { Block, Localized, Button as BlockButton } from "@/lib/landing/blocks";
import type { Lang } from "@/lib/i18n";

/** Pick the string for the active language. */
function t(v: Localized, lang: Lang): string {
  return v[lang] ?? v.en ?? "";
}

type AuthTab = "login" | "signup";

interface Ctx {
  lang: Lang;
  onAuth: (tab: AuthTab) => void;
}

function BlockButtonEl({ btn, ctx, className, style }: { btn: BlockButton; ctx: Ctx; className: string; style?: React.CSSProperties }) {
  const label = t(btn.label, ctx.lang);
  if (!label) return null;
  if (btn.action === "signup") return <button onClick={() => ctx.onAuth("signup")} className={className} style={style}>{label}</button>;
  if (btn.action === "login") return <button onClick={() => ctx.onAuth("login")} className={className} style={style}>{label}</button>;
  // link
  const href = btn.href || "#";
  const external = /^https?:\/\//.test(href);
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} style={style}>{label}</a>
  ) : (
    <Link href={href} className={className} style={style}>{label}</Link>
  );
}

function HeroBlock({ data, ctx }: { data: Extract<Block, { type: "hero" }>["data"]; ctx: Ctx }) {
  return (
    <section className="pt-24 pb-20 relative overflow-hidden" style={{ backgroundColor: data.bgColor }}>
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10" style={{ backgroundColor: data.accentColor }} />
      <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full opacity-10" style={{ backgroundColor: "#2085C7" }} />
      <div className="absolute top-20 right-1/3 w-48 h-48 rounded-full opacity-5" style={{ backgroundColor: "#EFA159" }} />
      <div className="max-w-4xl mx-auto px-6 relative z-10">
        {t(data.tag, ctx.lang) && (
          <div className="inline-block text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full mb-6" style={{ backgroundColor: data.accentColor, color: "white" }}>
            {t(data.tag, ctx.lang)}
          </div>
        )}
        <h1 className="text-5xl sm:text-6xl font-bold text-white leading-tight mb-6">
          {t(data.title, ctx.lang)}
          {t(data.titleAccent, ctx.lang) && (<><br /><span style={{ color: data.accentColor }}>{t(data.titleAccent, ctx.lang)}</span></>)}
        </h1>
        {t(data.desc, ctx.lang) && <p className="text-lg text-gray-300 max-w-2xl mb-10 leading-relaxed">{t(data.desc, ctx.lang)}</p>}
        <div className="flex flex-wrap gap-4">
          <BlockButtonEl btn={data.primary} ctx={ctx} className="px-7 py-3 rounded-lg text-white font-semibold text-sm" style={{ backgroundColor: data.accentColor }} />
          <BlockButtonEl btn={data.secondary} ctx={ctx} className="px-7 py-3 rounded-lg font-semibold text-sm border border-white/20 text-white hover:bg-white/10" />
        </div>
      </div>
    </section>
  );
}

function StatsBlock({ data, ctx }: { data: Extract<Block, { type: "stats" }>["data"]; ctx: Ctx }) {
  return (
    <section style={{ backgroundColor: data.bgColor }}>
      <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
        {data.items.map((s, i) => (
          <div key={i}>
            <p className="text-4xl font-bold text-white">{t(s.number, ctx.lang)}</p>
            <p className="text-sm text-blue-100 mt-1">{t(s.label, ctx.lang)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function FeaturesBlock({ data, ctx }: { data: Extract<Block, { type: "features" }>["data"]; ctx: Ctx }) {
  return (
    <section className="py-20" style={{ backgroundColor: data.bgColor }}>
      <div className="max-w-6xl mx-auto px-6">
        {t(data.title, ctx.lang) && <h2 className="text-3xl font-bold text-center mb-2" style={{ color: "#323131" }}>{t(data.title, ctx.lang)}</h2>}
        {t(data.subtitle, ctx.lang) && <p className="text-center text-gray-500 mb-12 text-sm">{t(data.subtitle, ctx.lang)}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.cards.map((f, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg mb-4" style={{ backgroundColor: f.color }}>{f.icon}</div>
              <h3 className="font-bold text-gray-900 mb-2">{t(f.title, ctx.lang)}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{t(f.desc, ctx.lang)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaBlock({ data, ctx }: { data: Extract<Block, { type: "cta" }>["data"]; ctx: Ctx }) {
  return (
    <section className="py-20 relative overflow-hidden" style={{ backgroundColor: data.bgColor }}>
      <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full opacity-10 bg-white" />
      <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full opacity-10 bg-white" />
      <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
        {t(data.title, ctx.lang) && <h2 className="text-4xl font-bold text-white mb-4">{t(data.title, ctx.lang)}</h2>}
        {t(data.desc, ctx.lang) && <p className="text-white/80 mb-8 text-lg">{t(data.desc, ctx.lang)}</p>}
        <BlockButtonEl btn={data.button} ctx={ctx} className="inline-block bg-white px-8 py-3 rounded-lg font-bold text-sm" style={{ color: data.bgColor }} />
      </div>
    </section>
  );
}

function RichTextBlock({ data, ctx }: { data: Extract<Block, { type: "richtext" }>["data"]; ctx: Ctx }) {
  const html = t(data.html, ctx.lang);
  return (
    <section className="py-12" style={{ backgroundColor: data.bgColor }}>
      <div
        className="max-w-3xl mx-auto px-6 prose prose-gray max-w-none"
        // Content is authored by admins via TipTap and sanitised server-side on save.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </section>
  );
}

function ImageBlock({ data, ctx }: { data: Extract<Block, { type: "image" }>["data"]; ctx: Ctx }) {
  if (!data.src) return null;
  const inner = (
    <figure>
      {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary external/upload URLs, not build-time assets */}
      <img src={data.src} alt={t(data.alt, ctx.lang)} className="w-full rounded-xl" />
      {t(data.caption, ctx.lang) && <figcaption className="text-center text-sm text-gray-500 mt-3">{t(data.caption, ctx.lang)}</figcaption>}
    </figure>
  );
  return (
    <section className="py-12">
      <div className={data.width === "full" ? "px-0" : "max-w-4xl mx-auto px-6"}>{inner}</div>
    </section>
  );
}

/** Render one block by type. Returns null for a hidden block. */
export function BlockView({ block, ctx }: { block: Block; ctx: Ctx }) {
  if (!block.visible) return null;
  switch (block.type) {
    case "hero": return <HeroBlock data={block.data} ctx={ctx} />;
    case "stats": return <StatsBlock data={block.data} ctx={ctx} />;
    case "features": return <FeaturesBlock data={block.data} ctx={ctx} />;
    case "cta": return <CtaBlock data={block.data} ctx={ctx} />;
    case "richtext": return <RichTextBlock data={block.data} ctx={ctx} />;
    case "image": return <ImageBlock data={block.data} ctx={ctx} />;
  }
}

export type { AuthTab };
