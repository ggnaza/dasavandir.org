"use client";

import { useState, useEffect, useRef } from "react";

const ALL_MODULES = [
  { id: "courses", label: "Courses" },
  { id: "ararka", label: "Ararka" },
  { id: "efficacy", label: "Efficacy" },
];

export function ModuleAccessToggle({ userId, userName }: { userId: string; userName: string }) {
  const [open, setOpen] = useState(false);
  const [modules, setModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (open && !loaded) {
      setLoading(true);
      fetch(`/api/admin/users/modules?user_id=${userId}`)
        .then((r) => r.json())
        .then((data: { modules: string[] }) => {
          setModules(data.modules ?? ["courses"]);
          setLoaded(true);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [open, loaded, userId]);

  const toggle = async (moduleId: string) => {
    const next = modules.includes(moduleId)
      ? modules.filter((m) => m !== moduleId)
      : [...modules, moduleId];

    if (next.length === 0) return;

    setModules(next);
    await fetch("/api/admin/users/modules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, modules: next }),
    });
  };

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="text-indigo-600 hover:underline text-sm"
      >
        Modules
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-lg shadow-lg border py-2 z-50">
          <div className="px-3 py-1 text-xs font-medium text-gray-500 border-b mb-1">
            Module access for {userName}
          </div>
          {loading ? (
            <div className="px-3 py-2 text-sm text-gray-400">Loading...</div>
          ) : (
            ALL_MODULES.map((m) => (
              <label
                key={m.id}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={modules.includes(m.id)}
                  onChange={() => void toggle(m.id)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">{m.label}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}
