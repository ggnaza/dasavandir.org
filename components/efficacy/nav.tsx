"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

type EfficacyNavProps = {
  role: "admin" | "ldm" | "teacher";
  userName?: string;
};

interface NavLink {
  href: string;
  label: string;
  exact?: boolean;
}

const LDM_LINKS: NavLink[] = [
  { href: "/efficacy/ldm", label: "Teachers", exact: true },
  { href: "/efficacy/ldm/observations", label: "Observations" },
  { href: "/efficacy/ldm/competency", label: "Competency" },
  { href: "/efficacy/ldm/chat", label: "Behaviors" },
];

const TEACHER_LINKS: NavLink[] = [
  { href: "/efficacy/teacher", label: "Dashboard", exact: true },
  { href: "/efficacy/teacher/reflections", label: "Reflection" },
  { href: "/efficacy/teacher/coach", label: "AI Coach" },
];

const ADMIN_LINKS: NavLink[] = [
  { href: "/efficacy/admin", label: "Management", exact: true },
  { href: "/efficacy/admin/chat-config", label: "AI Config" },
];

export function EfficacyNav({ role, userName }: EfficacyNavProps) {
  const pathname = usePathname();

  const links: NavLink[] =
    role === "admin"
      ? [...LDM_LINKS, { href: "", label: "|" }, ...ADMIN_LINKS]
      : role === "ldm"
        ? LDM_LINKS
        : TEACHER_LINKS;

  return (
    <nav className="bg-white border-b px-4 py-3">
      <div className="flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-4 sm:gap-6">
          <Link href="/efficacy" className="text-xl font-bold shrink-0" style={{ color: "#EC5328" }}>
            TFA Efficacy
          </Link>
          <div className="flex items-center gap-1 overflow-x-auto">
            {links.map((link, i) => {
              if (link.href === "") {
                return (
                  <span key={`sep-${i}`} className="text-gray-300 mx-1 select-none">
                    |
                  </span>
                );
              }
              const isActive = link.exact ? pathname === link.href : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive ? "bg-orange-50 text-orange-700" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {userName && <span className="text-sm text-gray-600 hidden sm:inline">{userName}</span>}
          <Link href="/learn" className="text-sm text-gray-500 hover:text-gray-700">
            LMS
          </Link>
        </div>
      </div>
    </nav>
  );
}
