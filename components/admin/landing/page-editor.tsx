"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import type { Lang } from "@/lib/i18n";
import { BLOCK_CATALOG, newBlock, type Block, type BlockType } from "@/lib/landing/blocks";
import type { PageRecord } from "@/lib/landing/store";
import { BlockView } from "@/components/landing/block-views";
import { BlockFields } from "./block-fields";

interface Localized { en: string; hy: string }

function uuid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `b-${Date.now()}-${Math.round(Math.random() * 1e9).toString(36)}`;
}

const catalogLabel = (t: BlockType) => BLOCK_CATALOG.find((c) => c.type === t)!;

export function PageEditor({ initial, previewHref }: { initial: PageRecord; previewHref: string }) {
  const [blocks, setBlocks] = useState<Block[]>(initial.blocks);
  const [title, setTitle] = useState<Localized>(initial.title);
  const [status, setStatus] = useState<"draft" | "published">(initial.status);
  const [seo, setSeo] = useState(initial.seo);
  const [lang, setLang] = useState<Lang>("en");
  const [selectedId, setSelectedId] = useState<string | null>(initial.blocks[0]?.id ?? null);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [showAdd, setShowAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const dirty = useCallback(() => { setSaved(false); }, []);

  const updateData = (id: string, data: Block["data"]) => {
    setBlocks((bs) => bs.map((b) => (b.id === id ? ({ ...b, data } as Block) : b)));
    dirty();
  };
  const move = (id: string, dir: -1 | 1) => {
    setBlocks((bs) => {
      const i = bs.findIndex((b) => b.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= bs.length) return bs;
      const next = [...bs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    dirty();
  };
  const toggleVisible = (id: string) => {
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, visible: !b.visible } : b)));
    dirty();
  };
  const remove = (id: string) => {
    setBlocks((bs) => bs.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
    dirty();
  };
  const add = (type: BlockType) => {
    const b = newBlock(type, uuid());
    setBlocks((bs) => [...bs, b]);
    setSelectedId(b.id);
    setShowAdd(false);
    setTab("edit");
    dirty();
  };

  async function save() {
    setSaving(true); setError(""); setSaved(false);
    try {
      const res = await fetch("/api/admin/pages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: initial.slug, title, blocks, status, seo }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Save failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const selected = blocks.find((b) => b.id === selectedId) ?? null;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/pages" className="text-sm text-gray-500 hover:text-gray-700">← All pages</Link>
          <h1 className="mt-1 text-2xl font-bold">{title.en || initial.slug}<span className="ml-2 text-sm font-normal text-gray-400">/{initial.slug === "home" ? "" : initial.slug}</span></h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1 text-xs">
            <button onClick={() => setLang("en")} className={`rounded-md px-2.5 py-1 font-medium ${lang === "en" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}>EN</button>
            <button onClick={() => setLang("hy")} className={`rounded-md px-2.5 py-1 font-medium ${lang === "hy" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}>ՀՅ</button>
          </div>
          <select value={status} onChange={(e) => { setStatus(e.target.value as "draft" | "published"); dirty(); }} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
          <a href={previewHref} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-600 hover:text-gray-900">View ↗</a>
          <button onClick={() => void save()} disabled={saving} className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {saved && <p className="mb-3 text-sm text-green-600">Saved.</p>}

      {/* Page settings (title + SEO) */}
      <div className="mb-4 rounded-xl border bg-white">
        <button onClick={() => setShowSettings((s) => !s)} className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-gray-700">
          Page settings <span className="text-gray-400">{showSettings ? "▲" : "▼"}</span>
        </button>
        {showSettings && (
          <div className="grid gap-3 border-t px-4 py-4 sm:grid-cols-2">
            <label className="block"><span className="mb-1 block text-xs font-medium text-gray-500">Page name · {lang.toUpperCase()}</span>
              <input className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={title[lang]} onChange={(e) => { setTitle({ ...title, [lang]: e.target.value }); dirty(); }} /></label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-gray-500">SEO title · {lang.toUpperCase()}</span>
              <input className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={seo.title?.[lang] ?? ""} onChange={(e) => { setSeo({ ...seo, title: { en: seo.title?.en ?? "", hy: seo.title?.hy ?? "", [lang]: e.target.value } }); dirty(); }} /></label>
            <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-medium text-gray-500">SEO description · {lang.toUpperCase()}</span>
              <textarea className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={seo.description?.[lang] ?? ""} onChange={(e) => { setSeo({ ...seo, description: { en: seo.description?.en ?? "", hy: seo.description?.hy ?? "", [lang]: e.target.value } }); dirty(); }} /></label>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        {/* Block list */}
        <div>
          <div className="space-y-2">
            {blocks.map((b, i) => {
              const meta = catalogLabel(b.type);
              return (
                <div key={b.id} className={`rounded-lg border p-2 ${selectedId === b.id ? "border-brand-400 bg-brand-50" : "border-gray-200 bg-white"}`}>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setSelectedId(b.id)} className="flex flex-1 items-center gap-2 text-left">
                      <span className="text-lg">{meta.icon}</span>
                      <span className={`text-sm ${b.visible ? "text-gray-800" : "text-gray-400 line-through"}`}>{meta.label}</span>
                    </button>
                    <button title="Move up" onClick={() => move(b.id, -1)} disabled={i === 0} className="px-1 text-gray-400 hover:text-gray-700 disabled:opacity-30">↑</button>
                    <button title="Move down" onClick={() => move(b.id, 1)} disabled={i === blocks.length - 1} className="px-1 text-gray-400 hover:text-gray-700 disabled:opacity-30">↓</button>
                    <button title={b.visible ? "Hide" : "Show"} onClick={() => toggleVisible(b.id)} className="px-1 text-gray-400 hover:text-gray-700">{b.visible ? "👁" : "🚫"}</button>
                    <button title="Delete" onClick={() => remove(b.id)} className="px-1 text-red-400 hover:text-red-600">✕</button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="relative mt-3">
            <button onClick={() => setShowAdd((s) => !s)} className="w-full rounded-lg border border-dashed border-gray-300 py-2 text-sm text-gray-600 hover:border-brand-400 hover:text-brand-600">+ Add section</button>
            {showAdd && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border bg-white shadow-lg">
                {BLOCK_CATALOG.map((c) => (
                  <button key={c.type} onClick={() => add(c.type)} className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-gray-50">
                    <span className="text-lg">{c.icon}</span>
                    <span><span className="block text-sm font-medium text-gray-800">{c.label}</span><span className="block text-xs text-gray-500">{c.hint}</span></span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right pane: edit / preview */}
        <div>
          <div className="mb-3 flex gap-1 rounded-lg bg-gray-100 p-1 text-sm w-fit">
            <button onClick={() => setTab("edit")} className={`rounded-md px-3 py-1 ${tab === "edit" ? "bg-white shadow-sm" : "text-gray-500"}`}>Edit section</button>
            <button onClick={() => setTab("preview")} className={`rounded-md px-3 py-1 ${tab === "preview" ? "bg-white shadow-sm" : "text-gray-500"}`}>Preview page</button>
          </div>

          {tab === "edit" ? (
            selected ? (
              <div className="rounded-xl border bg-white p-4">
                <p className="mb-3 text-sm font-semibold text-gray-700">{catalogLabel(selected.type).icon} {catalogLabel(selected.type).label}</p>
                <BlockFields block={selected} lang={lang} onChange={(data) => updateData(selected.id, data)} />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-gray-400">Select a section on the left to edit it, or add one.</div>
            )
          ) : (
            <div className="overflow-hidden rounded-xl border bg-white">
              {blocks.length === 0 && <div className="p-8 text-center text-sm text-gray-400">No sections yet.</div>}
              {blocks.map((b) => (
                <div key={b.id} className="relative">
                  {!b.visible && <span className="absolute right-2 top-2 z-10 rounded bg-gray-800/70 px-2 py-0.5 text-xs text-white">Hidden</span>}
                  <div style={{ opacity: b.visible ? 1 : 0.4 }}>
                    <BlockView block={{ ...b, visible: true }} ctx={{ lang, onAuth: () => {} }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
