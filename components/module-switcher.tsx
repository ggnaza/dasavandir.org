"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";

interface Module {
  id: string;
  label: string;
  href: string;
  color: string;
}

const ALL_MODULES: Module[] = [
  { id: "courses", label: "Courses", href: "/learn", color: "#2563EB" },
  { id: "ararka", label: "Ararka", href: "/ararka", color: "#2563EB" },
  { id: "efficacy", label: "Efficacy", href: "/efficacy", color: "#059669" },
];

export function ModuleSwitcher({ modules, isAdmin }: { modules: string[]; isAdmin?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const available = isAdmin
    ? ALL_MODULES
    : ALL_MODULES.filter((m) => modules.includes(m.id));

  const current = available.find(
    (m) =>
      pathname.startsWith(m.href) ||
      (m.id === "courses" && (pathname.startsWith("/learn") || pathname.startsWith("/admin"))),
  ) ?? available[0];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (available.length <= 1) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors text-sm"
      >
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: current?.color }} />
        <span className="font-medium text-gray-700">{current?.label}</span>
        <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                href={m.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 ${isActive ? "bg-gray-50 font-medium text-gray-900" : "text-gray-600"}`}
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
                href="/admin"
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
