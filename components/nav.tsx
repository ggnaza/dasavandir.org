"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LanguageToggle } from "@/components/language-toggle";
import type { Lang } from "@/lib/i18n";
import { translations } from "@/lib/i18n";

type NavProps = {
  role: "admin" | "learner";
  userName?: string;
  unreadNotifications?: number;
  lang?: Lang;
};

export function Nav({ role, userName, unreadNotifications = 0, lang = "en" }: NavProps) {
  const router = useRouter();
  const T = translations[lang];

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
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
          { href: "/admin/analytics", label: "Analytics" },
        ]
      : [
          { href: "/learn", label: T.myCourses },
          { href: "/learn/progress", label: T.myProgress },
          { href: "/courses", label: T.browse },
        ];

  return (
    <nav className="bg-white border-b px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/" className="font-bold text-brand-600">Dasavandir</Link>
        <div className="hidden sm:flex gap-4 text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-gray-600 hover:text-gray-900">
              {l.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3 text-sm">
        {userName && <span className="text-gray-500 hidden sm:inline">{userName}</span>}
        {role === "learner" && (
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
        <button onClick={handleSignOut} className="text-gray-600 hover:text-gray-900">
          {T.signOut}
        </button>
      </div>
    </nav>
  );
}
