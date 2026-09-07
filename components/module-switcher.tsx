"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { MODULES, type ModuleId } from "@/lib/modules";

/**
 * Cross-module switcher.
 *
 * `modules` is the list of module ids the signed-in user may enter, computed
 * server-side from `module_access`. When the user is on a module subdomain the
 * other modules live on different hosts, so those links must be absolute —
 * a relative `/efficacy` from gnahatum.dasavandir.org would 404.
 */
export function ModuleSwitcher({
  modules,
  isAdmin,
  onSubdomain = false,
}: {
  modules: ModuleId[] | string[];
  isAdmin?: boolean;
  onSubdomain?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const available = isAdmin ? MODULES : MODULES.filter((m) => modules.includes(m.id));

  const current =
    available.find(
      (m) =>
        pathname.startsWith(m.href) ||
        (m.id === "courses" && (pathname.startsWith("/learn") || pathname.startsWith("/admin"))),
    ) ?? available[0];

  /**
   * On a module subdomain the app's own routes are served from `/`, so the
   * main-host paths have to be rebuilt against the parent domain.
   * `gnahatum.dasavandir.org` -> `dasavandir.org`;
   * `staging.gnahatum.dasavandir.org` -> `staging.dasavandir.org`.
   */
  function hrefFor(href: string): string {
    if (!onSubdomain || !origin) return href;
    try {
      const url = new URL(origin);
      const parts = url.hostname.split(".");
      const moduleSegment = MODULES.findIndex((m) => parts.includes(m.id));
      if (moduleSegment === -1) return href;
      url.hostname = parts.filter((p) => !MODULES.some((m) => m.id === p)).join(".");
      url.pathname = href;
      return url.toString();
    } catch {
      return href;
    }
  }

  if (available.length <= 1) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors text-sm"
      >
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: current?.color }} />
        <span className="font-medium text-gray-700">{current?.label}</span>
        <svg
          className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-44 bg-white rounded-lg shadow-lg border py-1 z-50">
          {available.map((m) => {
            const isActive = m.id === current?.id;
            return (
              <Link
                key={m.id}
                href={hrefFor(m.href)}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 ${
                  isActive ? "bg-gray-50 font-medium text-gray-900" : "text-gray-600"
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                {m.label}
              </Link>
            );
          })}
          {isAdmin && (
            <>
              <div className="border-t my-1" />
              <Link
                href={hrefFor("/admin")}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                Admin Panel
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
