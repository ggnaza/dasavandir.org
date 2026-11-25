"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ModuleSwitcher } from "@/components/module-switcher";
import type { ModuleId } from "@/lib/modules";

export function AttestationNav({
  userName,
  modules,
  isAdmin,
  isManager,
}: {
  userName?: string;
  modules: ModuleId[];
  isAdmin: boolean;
  isManager: boolean;
}) {
  const pathname = usePathname();
  const links = [
    { href: "/attestation", label: "Թեստեր", exact: true },
    ...(isManager ? [{ href: "/attestation/manage", label: "Manage tests", exact: false }] : []),
  ];
  return (
    <nav className="bg-white border-b px-4 py-3">
      <div className="flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-4 sm:gap-6">
          <Link href="/attestation" className="text-xl font-bold shrink-0" style={{ color: "#7C3AED" }}>
            Attestation
          </Link>
          <ModuleSwitcher modules={modules} isAdmin={isAdmin} />
          <div className="flex items-center gap-1 overflow-x-auto">
            {links.map((l) => {
              const active = l.exact ? pathname === l.href : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap ${
                    active ? "bg-violet-50 text-violet-700" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>
        </div>
        {userName && <span className="text-sm text-gray-600 hidden sm:inline">{userName}</span>}
      </div>
    </nav>
  );
}
