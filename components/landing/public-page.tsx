"use client";

import { useState } from "react";
import Link from "next/link";
import { LanguageToggle } from "@/components/language-toggle";
import { AuthModal } from "@/components/auth-modal";
import { translations, type Lang } from "@/lib/i18n";
import type { Block } from "@/lib/landing/blocks";
import type { MenuItem } from "@/lib/landing/defaults";
import { BlockView, type AuthTab } from "./block-views";

interface Props {
  blocks: Block[];
  nav: MenuItem[];
  footer: MenuItem[];
  lang: Lang;
}

function MenuLink({ item, lang, className }: { item: MenuItem; lang: Lang; className: string }) {
  const label = item.label[lang] || item.label.en;
  if (!label) return null;
  const external = /^https?:\/\//.test(item.href);
  return external ? (
    <a href={item.href} className={className} target="_blank" rel="noopener noreferrer">{label}</a>
  ) : (
    <Link href={item.href} className={className}>{label}</Link>
  );
}

export function PublicPage({ blocks, nav, footer, lang }: Props) {
  const T = translations[lang];
  const [modal, setModal] = useState<AuthTab | null>(null);
  const onAuth = (tab: AuthTab) => setModal(tab);

  const visibleBlocks = blocks.filter((b) => b.visible);
  const firstIsHero = visibleBlocks[0]?.type === "hero";
  const navLinks = nav.filter((m) => m.visible);
  const footerLinks = footer.filter((m) => m.visible);

  return (
    <div className="min-h-screen bg-white font-sans">
      {modal && <AuthModal defaultTab={modal} onClose={() => setModal(null)} lang={lang} />}

      {/* Nav */}
      <nav className="fixed top-0 w-full z-40 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-bold" style={{ color: "#EC5328" }}>Դasavandir</span>
            <span className="text-xs text-gray-400 mt-1">.org</span>
          </Link>
          <div className="flex items-center gap-3">
            <LanguageToggle current={lang} />
            {navLinks.map((m) => (
              <MenuLink key={m.id} item={m} lang={lang} className="text-sm text-gray-600 hover:text-gray-900 font-medium" />
            ))}
            <button onClick={() => onAuth("login")} className="text-sm text-gray-600 hover:text-gray-900 font-medium">{T.signIn}</button>
            <button onClick={() => onAuth("signup")} className="text-sm text-white px-4 py-2 rounded-lg font-medium" style={{ backgroundColor: "#EC5328" }}>{T.getStarted}</button>
          </div>
        </div>
      </nav>

      {/* Blocks (clear the fixed nav when the first block isn't a full-bleed hero) */}
      <div className={firstIsHero ? "" : "pt-20"}>
        {visibleBlocks.map((b) => (
          <BlockView key={b.id} block={b} ctx={{ lang, onAuth }} />
        ))}
      </div>

      {/* Footer */}
      <footer style={{ backgroundColor: "#323131" }}>
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="text-xl font-bold" style={{ color: "#EC5328" }}>Դasavandir.org</span>
            <p className="text-gray-400 text-xs mt-1">{T.builtBy}</p>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-gray-400">
            <button onClick={() => onAuth("login")} className="hover:text-white">{T.signIn}</button>
            <button onClick={() => onAuth("signup")} className="hover:text-white">{T.getStarted}</button>
            {footerLinks.map((m) => (
              <MenuLink key={m.id} item={m} lang={lang} className="hover:text-white" />
            ))}
          </div>
          <p className="text-gray-500 text-xs">© {new Date().getFullYear()} Teach For Armenia. {T.allRights}</p>
        </div>
      </footer>
    </div>
  );
}
