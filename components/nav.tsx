"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LanguageToggle } from "@/components/language-toggle";
import type { Lang } from "@/lib/i18n";
import { translations } from "@/lib/i18n";

type NavProps = {
  role: "admin" | "learner" | "creator" | "moderator";
  userName?: string;
  unreadNotifications?: number;
  lang?: Lang;
};

export function Nav({ role, userName, unreadNotifications = 0, lang = "en" }: NavProps) {
  const router = useRouter();
  const T = translations[lang];
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const links =
    role === "admin"
      ? [
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/courses", label: "Courses" },
          { href: "/admin/ai-builder", label: "✦ AI Builder" },
          { href: "/admin/submissions", label: "Submissions" },
          { href: "/admin/capstone-submissions", label: "Capstones" },
          { href: "/admin/learners", label: "Learners" },
          { href: "/admin/analytics", label: "Analytics" },
          { href: "/admin/users", label: "Users" },
          { href: "/admin/settings", label: "Settings" },
        ]
      : role === "creator"
      ? [
          { href: "/learn", label: "My Courses" },
          { href: "/learn/progress", label: "Progress" },
          { href: "/courses", label: "Browse" },
        ]
      : role === "moderator"
      ? [
          { href: "/learn", label: "My Courses" },
          { href: "/admin/courses", label: "Courses" },
        ]
      : [
          { href: "/learn", label: T.myCourses },
          { href: "/learn/progress", label: T.myProgress },
          { href: "/courses", label: T.browse },
        ];

  return (
    <nav className="bg-white border-b px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 sm:gap-6">
          <Link href="/" className="flex items-center gap-1 shrink-0">
            <span className="text-xl font-bold" style={{ color: "#EC5328" }}>Դasavandir</span>
            <span className="text-xs text-gray-400 mt-1">.org</span>
          </Link>
          {/* Desktop nav */}
          <div className="hidden md:flex gap-4 text-sm">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="text-gray-600 hover:text-gray-900 whitespace-nowrap">
                {l.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 text-sm">
          {userName && <span className="text-gray-500 hidden sm:inline truncate max-w-[120px]">{userName}</span>}
          {(role === "learner" || role === "creator") && (
            <>
              <LanguageToggle current={lang} />
              <Link href="/learn/notifications" className="relative">
                <span className="text-gray-600 hover:text-gray-900 text-lg leading-none">🔔</span>
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium">
                    {unreadNotifications > 9 ? "9+" : unreadNotifications}
                  </span>
                )}
              </Link>
            </>
          )}
          <button onClick={handleSignOut} className="text-gray-600 hover:text-gray-900 hidden sm:block">
            {T.signOut}
          </button>
          {/* Hamburger — mobile only */}
          <button
            className="md:hidden p-1.5 rounded-lg hover:bg-gray-100"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Menu"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden mt-3 pb-2 border-t pt-3 space-y-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className="block px-2 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
            >
              {l.label}
            </Link>
          ))}
          {userName && <p className="px-2 py-1 text-xs text-gray-400">{userName}</p>}
          <button
            onClick={handleSignOut}
            className="block w-full text-left px-2 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
          >
            {T.signOut}
          </button>
        </div>
      )}
    </nav>
  );
}
