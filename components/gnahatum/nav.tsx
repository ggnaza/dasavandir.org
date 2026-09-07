"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ModuleSwitcher } from "@/components/module-switcher";
import type { ModuleId } from "@/lib/modules";

interface NavLink {
  href: string;
  label: string;
  exact?: boolean;
  ldmOnly?: boolean;
}

const LINKS: NavLink[] = [
  { href: "/gnahatum", label: "Tests", exact: true },
  { href: "/gnahatum/scan", label: "Upload & Score" },
  { href: "/gnahatum/results", label: "Results" },
  { href: "/gnahatum/calibrate", label: "Calibrate", ldmOnly: true },
];

/** On gnahatum.dasavandir.org the app is served from `/`, so drop the prefix. */
function stripPrefix(href: string, onSubdomain: boolean): string {
  if (onSubdomain) return href.replace(/^\/gnahatum/, "") || "/";
  return href;
}

export function GnahatumNav({
  userName,
  modules,
  isAdmin,
  isLdm = false,
  onSubdomain = false,
}: {
  userName?: string;
  modules?: ModuleId[] | string[];
  isAdmin?: boolean;
  isLdm?: boolean;
  onSubdomain?: boolean;
}) {
  const pathname = usePathname();
  const links = LINKS.filter((l) => !l.ldmOnly || isLdm || isAdmin);

  return (
    <nav className="bg-white border-b px-4 py-3">
      <div className="flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-4 sm:gap-6">
          <Link
            href={stripPrefix("/gnahatum", onSubdomain)}
            className="text-xl font-bold shrink-0"
            style={{ color: "#059669" }}
          >
            Gnahatum
          </Link>
          <ModuleSwitcher
            modules={modules ?? ["courses", "gnahatum"]}
            isAdmin={isAdmin}
            onSubdomain={onSubdomain}
          />
          <div className="flex items-center gap-1 overflow-x-auto">
            {links.map((link) => {
              const isActive = link.exact
                ? pathname === link.href || pathname === stripPrefix(link.href, true)
                : pathname.startsWith(link.href) || pathname.startsWith(stripPrefix(link.href, true));
              return (
                <Link
                  key={link.href}
                  href={stripPrefix(link.href, onSubdomain)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
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
        </div>
      </div>
    </nav>
  );
}
