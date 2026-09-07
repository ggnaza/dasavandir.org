"use client";

import { useState, useEffect, useRef } from "react";
import { MODULES, type AccessLevel, type ModuleId } from "@/lib/modules";

type Grants = Record<ModuleId, AccessLevel>;

const EMPTY: Grants = { courses: "none", efficacy: "none", gnahatum: "none" };

/**
 * Per-module access editor for one user.
 *
 * Each module gets its own level, so "LDM in Efficacy, plain teacher in
 * Gnahatum, no Courses at all" is expressible — the old checkbox list could
 * only say yes/no per module and carried a single global LDM tick.
 */
export function ModuleAccessToggle({ userId, userName }: { userId: string; userName: string }) {
  const [open, setOpen] = useState(false);
  const [grants, setGrants] = useState<Grants>(EMPTY);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<ModuleId | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    if (!open || loaded) return;
    setLoading(true);
    fetch(`/api/admin/users/module-access?user_id=${userId}`)
      .then((r) => r.json())
      .then((data: { grants?: Grants; isPlatformAdmin?: boolean; error?: string }) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setGrants(data.grants ?? EMPTY);
        setIsPlatformAdmin(!!data.isPlatformAdmin);
        setLoaded(true);
      })
      .catch(() => setError("Could not load module access"))
      .finally(() => setLoading(false));
  }, [open, loaded, userId]);

  const setLevel = async (moduleId: ModuleId, level: AccessLevel) => {
    const previous = grants;
    const next = { ...grants, [moduleId]: level };
    setGrants(next);
    setSaving(moduleId);
    setError(null);
    try {
      const res = await fetch("/api/admin/users/module-access", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, grants: { [moduleId]: level } }),
      });
      const data = (await res.json()) as { grants?: Grants; error?: string };
      if (!res.ok || data.error) {
        setGrants(previous);
        setError(data.error ?? "Save failed");
      } else if (data.grants) {
        setGrants(data.grants);
      }
    } catch {
      setGrants(previous);
      setError("Save failed");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="relative inline-block" ref={ref}>
      <button onClick={() => setOpen(!open)} className="text-indigo-600 hover:underline text-sm">
        Modules
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-white rounded-lg shadow-lg border py-2 z-50">
          <div className="px-3 py-1 text-xs font-medium text-gray-500 border-b mb-1">
            Module access for {userName}
          </div>

          {isPlatformAdmin && (
            <div className="px-3 py-2 text-xs text-amber-700 bg-amber-50 mx-2 rounded mb-1">
              Platform admin — full access to every module regardless of these settings.
            </div>
          )}

          {loading ? (
            <div className="px-3 py-2 text-sm text-gray-400">Loading…</div>
          ) : (
            MODULES.map((m) => (
              <div key={m.id} className="px-3 py-2 hover:bg-gray-50">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                    {m.label}
                  </span>
                  <select
                    value={grants[m.id]}
                    disabled={isPlatformAdmin || saving === m.id}
                    onChange={(e) => void setLevel(m.id, e.target.value as AccessLevel)}
                    className="text-sm border-gray-300 rounded-md py-1 pl-2 pr-7 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    <option value="none">No access</option>
                    <option value="member">{m.memberLabel}</option>
                    <option value="ldm">{m.ldmLabel}</option>
                  </select>
                </div>
              </div>
            ))
          )}

          {error && <div className="px-3 py-2 text-xs text-red-600">{error}</div>}
        </div>
      )}
    </div>
  );
}
