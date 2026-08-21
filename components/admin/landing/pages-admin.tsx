"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export interface PageSummary {
  slug: string;
  title: { en: string; hy: string };
  status: "draft" | "published";
  is_system: boolean;
}

export function PagesAdmin({ pages }: { pages: PageSummary[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/admin/pages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: slug.trim(), title: { en: name.trim(), hy: name.trim() } }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not create page");
      router.push(`/admin/pages/${d.page.slug}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create page");
    } finally { setBusy(false); }
  }

  async function del(pageSlug: string) {
    if (!confirm(`Delete the "${pageSlug}" page? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/pages?slug=${encodeURIComponent(pageSlug)}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else { const d = await res.json(); alert(d.error || "Delete failed"); }
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border bg-white">
        {pages.map((p) => (
          <div key={p.slug} className="flex items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">{p.title.en || p.slug}</span>
                {p.is_system && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">System</span>}
                <span className={`rounded px-1.5 py-0.5 text-xs ${p.status === "published" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{p.status}</span>
              </div>
              <span className="text-xs text-gray-400">/{p.slug === "home" ? "" : p.slug}</span>
            </div>
            <div className="flex shrink-0 items-center gap-3 text-sm">
              <a href={`/${p.slug === "home" ? "" : p.slug}`} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-800">View ↗</a>
              <Link href={`/admin/pages/${p.slug}`} className="font-medium text-brand-600 hover:text-brand-700">Edit</Link>
              {!p.is_system && <button onClick={() => void del(p.slug)} className="text-red-500 hover:text-red-600">Delete</button>}
            </div>
          </div>
        ))}
        {pages.length === 0 && <div className="px-4 py-6 text-sm text-gray-400">No pages yet.</div>}
      </div>

      {creating ? (
        <div className="rounded-xl border bg-white p-4">
          <p className="mb-3 text-sm font-semibold">New page</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="mb-1 block text-xs font-medium text-gray-500">Page name</span>
              <input className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="About us" /></label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-gray-500">Address (slug)</span>
              <input className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} placeholder="about-us" /></label>
          </div>
          {slug && <p className="mt-1 text-xs text-gray-400">Will be at dasavandir.org/{slug}</p>}
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button onClick={() => void create()} disabled={busy || !slug || !name} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{busy ? "Creating…" : "Create & edit"}</button>
            <button onClick={() => setCreating(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setCreating(true)} className="rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm text-gray-600 hover:border-brand-400 hover:text-brand-600">+ New page</button>
      )}
    </div>
  );
}
