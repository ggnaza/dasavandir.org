"use client";

import { useState } from "react";
import type { MenuItem, MenuLocation } from "@/lib/landing/defaults";

function uid() { return `m-${Date.now()}-${Math.round(Math.random() * 1e6).toString(36)}`; }

const input = "w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm";

export function MenuManager({ initialItems }: { initialItems: MenuItem[] }) {
  const [items, setItems] = useState<MenuItem[]>(initialItems.filter((m) => m.href || m.label.en || m.label.hy));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const patch = (id: string, p: Partial<MenuItem>) => { setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x))); setSaved(false); };
  const remove = (id: string) => { setItems((xs) => xs.filter((x) => x.id !== id)); setSaved(false); };
  const move = (id: string, dir: -1 | 1) => {
    setItems((xs) => {
      const loc = xs.find((x) => x.id === id)?.location;
      const group = xs.filter((x) => x.location === loc);
      const gi = group.findIndex((x) => x.id === id);
      const gj = gi + dir;
      if (gi < 0 || gj < 0 || gj >= group.length) return xs;
      [group[gi], group[gj]] = [group[gj], group[gi]];
      const others = xs.filter((x) => x.location !== loc);
      // Rebuild preserving relative order: nav group then footer group
      const nav = loc === "nav" ? group : xs.filter((x) => x.location === "nav");
      const footer = loc === "footer" ? group : xs.filter((x) => x.location === "footer");
      void others;
      return [...nav, ...footer];
    });
    setSaved(false);
  };
  const add = (location: MenuLocation) => {
    setItems((xs) => [...xs, { id: uid(), location, label: { en: "", hy: "" }, href: "", visible: true }]);
    setSaved(false);
  };

  async function save() {
    setSaving(true); setError(""); setSaved(false);
    try {
      const payload = items
        .filter((m) => m.href.trim() !== "")
        .map((m) => ({ location: m.location, label: m.label, href: m.href.trim(), visible: m.visible }));
      const res = await fetch("/api/admin/menu", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: payload }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Save failed");
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally { setSaving(false); }
  }

  const groups: { loc: MenuLocation; title: string }[] = [
    { loc: "nav", title: "Top navigation" },
    { loc: "footer", title: "Footer" },
  ];

  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Navigation &amp; footer links</h2>
          <p className="text-sm text-gray-500">Links shown in the public site header and footer. Sign-in / Get-started buttons are always shown.</p>
        </div>
        <button onClick={() => void save()} disabled={saving} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{saving ? "Saving…" : "Save links"}</button>
      </div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {saved && <p className="mb-2 text-sm text-green-600">Saved.</p>}

      <div className="grid gap-6 sm:grid-cols-2">
        {groups.map(({ loc, title }) => {
          const group = items.filter((m) => m.location === loc);
          return (
            <div key={loc}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</p>
              <div className="space-y-2">
                {group.map((m, i) => (
                  <div key={m.id} className="rounded-lg border border-gray-200 p-2.5 space-y-1.5">
                    <div className="grid grid-cols-2 gap-1.5">
                      <input className={input} placeholder="Label (EN)" value={m.label.en} onChange={(e) => patch(m.id, { label: { ...m.label, en: e.target.value } })} />
                      <input className={input} placeholder="Label (ՀՅ)" value={m.label.hy} onChange={(e) => patch(m.id, { label: { ...m.label, hy: e.target.value } })} />
                    </div>
                    <input className={input} placeholder="/courses or https://…" value={m.href} onChange={(e) => patch(m.id, { href: e.target.value })} />
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <label className="flex items-center gap-1"><input type="checkbox" checked={m.visible} onChange={(e) => patch(m.id, { visible: e.target.checked })} /> Visible</label>
                      <span className="flex-1" />
                      <button onClick={() => move(m.id, -1)} disabled={i === 0} className="disabled:opacity-30">↑</button>
                      <button onClick={() => move(m.id, 1)} disabled={i === group.length - 1} className="disabled:opacity-30">↓</button>
                      <button onClick={() => remove(m.id)} className="text-red-500 hover:text-red-600">Remove</button>
                    </div>
                  </div>
                ))}
                <button onClick={() => add(loc)} className="text-xs font-medium text-brand-600 hover:text-brand-700">+ Add link</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
