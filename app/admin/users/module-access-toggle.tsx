"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { MODULES, type AccessLevel, type ModuleId } from "@/lib/modules";

type Grants = Record<ModuleId, AccessLevel>;

const EMPTY: Grants = { courses: "none", efficacy: "none", gnahatum: "none" };

const PANEL_WIDTH = 288; // w-72
const PANEL_MAX_HEIGHT = 320;
const GAP = 4;

/**
 * Per-module access editor for one user.
 *
 * Each module gets its own level, so "LDM in Efficacy, plain teacher in
 * Gnahatum, no Courses at all" is expressible — the old checkbox list could
 * only say yes/no per module and carried a single global LDM tick.
 *
 * The panel is rendered through a portal onto `document.body` rather than
 * positioned inside the row. The users table sits in a wrapper with
 * `overflow-hidden` (for its rounded corners), which clipped an absolutely
 * positioned panel: on the last row all you saw was the heading with the
 * dropdowns cut off below the table edge. A portal escapes that container
 * entirely, so the panel can never be trimmed by an ancestor's overflow.
 */
export function ModuleAccessToggle({ userId, userName }: { userId: string; userName: string }) {
  const [open, setOpen] = useState(false);
  const [grants, setGrants] = useState<Grants>(EMPTY);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<ModuleId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /** Anchor the fixed-position panel to the button, flipping up when tight. */
  const place = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const r = button.getBoundingClientRect();

    const spaceBelow = window.innerHeight - r.bottom - GAP * 2;
    const spaceAbove = r.top - GAP * 2;
    const height = panelRef.current?.offsetHeight ?? PANEL_MAX_HEIGHT;
    const flipUp = spaceBelow < height && spaceAbove > spaceBelow;

    // Right-align to the button, then clamp inside the viewport.
    const left = Math.min(
      Math.max(GAP, r.right - PANEL_WIDTH),
      window.innerWidth - PANEL_WIDTH - GAP,
    );

    // Cap to the space actually available on the chosen side and let the panel
    // scroll internally. Without this, a short viewport (or a button near the
    // fold with no room either way) pushes a fixed-position panel past the
    // viewport edge, where nothing can scroll it back into reach.
    const maxHeight = Math.min(PANEL_MAX_HEIGHT, Math.max(120, flipUp ? spaceAbove : spaceBelow));
    const top = flipUp ? Math.max(GAP, r.top - Math.min(height, maxHeight) - GAP) : r.bottom + GAP;
    setPos({ top, left, maxHeight });
  }, []);

  useEffect(() => {
    if (!open) return;
    place();
    const onScroll = () => place();
    // `true` so scrolling any ancestor, not just the window, repositions it.
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, place, loading]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const t = e.target as Node;
      if (buttonRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
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
    setGrants({ ...grants, [moduleId]: level });
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

  const panel = (
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        width: PANEL_WIDTH,
        maxHeight: pos?.maxHeight ?? PANEL_MAX_HEIGHT,
      }}
      className="bg-white rounded-lg shadow-xl border py-2 z-[100] overflow-y-auto"
    >
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
  );

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className="text-indigo-600 hover:underline text-sm"
      >
        Modules
      </button>
      {open && typeof document !== "undefined" && createPortal(panel, document.body)}
    </>
  );
}
