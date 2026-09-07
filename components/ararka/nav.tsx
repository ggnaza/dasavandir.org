"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavLink {
  href: string;
  label: string;
  exact?: boolean;
}

const LINKS: NavLink[] = [
  { href: "/ararka", label: "Tests", exact: true },
  { href: "/ararka/scan", label: "Upload & Score" },
  { href: "/ararka/results", label: "Results" },
  { href: "/ararka/calibrate", label: "Calibrate" },
];

export function ArarkaNav({ userName }: { userName?: string }) {
  const pathname = usePathname();

  return (
    <nav className="bg-white border-b px-4 py-3">
      <div className="flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-4 sm:gap-6">
          <Link href="/ararka" className="text-xl font-bold shrink-0" style={{ color: "#2563EB" }}>
            Ararka
          </Link>
          <div className="flex items-center gap-1 overflow-x-auto">
            {LINKS.map((link) => {
              const isActive = link.exact ? pathname === link.href : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
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
