"use client";

import { useState } from "react";
import type { Lang } from "@/lib/i18n";
import type { Localized, Button as BlockButton, ButtonAction } from "@/lib/landing/blocks";

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-500 mb-1">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-0 outline-none";

export function TextInput({
  value, onChange, placeholder, multiline,
}: { value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean }) {
  return multiline ? (
    <textarea className={`${inputCls} min-h-[80px]`} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
  ) : (
    <input className={inputCls} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
  );
}

/** Edits one language of a bilingual string (the active editing language). */
export function LocalizedInput({
  label, value, lang, onChange, placeholder, multiline,
}: { label: string; value: Localized; lang: Lang; onChange: (v: Localized) => void; placeholder?: string; multiline?: boolean }) {
  return (
    <Field label={`${label} · ${lang.toUpperCase()}`}>
      <TextInput
        value={value[lang]}
        placeholder={placeholder}
        multiline={multiline}
        onChange={(v) => onChange({ ...value, [lang]: v })}
      />
    </Field>
  );
}

export function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 rounded border border-gray-200 bg-white p-0.5" />
        <input className={`${inputCls} font-mono`} value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </Field>
  );
}

export function ImageInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function upload(file: File) {
    setBusy(true); setErr("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/landing/upload", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Upload failed");
      onChange(d.url as string);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Field label={label}>
      {value && <img src={value} alt="" className="mb-2 max-h-32 rounded-lg border border-gray-200" />}
      <div className="flex items-center gap-2">
        <input className={inputCls} value={value} placeholder="Image URL, or upload →" onChange={(e) => onChange(e.target.value)} />
        <label className="shrink-0 cursor-pointer rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50">
          {busy ? "…" : "Upload"}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
        </label>
      </div>
      {err && <span className="mt-1 block text-xs text-red-600">{err}</span>}
    </Field>
  );
}

const ACTIONS: { value: ButtonAction; label: string }[] = [
  { value: "signup", label: "Open sign-up" },
  { value: "login", label: "Open sign-in" },
  { value: "link", label: "Go to a link" },
];

export function ButtonEditor({ label, value, lang, onChange }: { label: string; value: BlockButton; lang: Lang; onChange: (v: BlockButton) => void }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3 space-y-2">
      <p className="text-xs font-semibold text-gray-600">{label}</p>
      <LocalizedInput label="Button text" value={value.label} lang={lang} onChange={(v) => onChange({ ...value, label: v })} />
      <Field label="On click">
        <select className={inputCls} value={value.action} onChange={(e) => onChange({ ...value, action: e.target.value as ButtonAction })}>
          {ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
      </Field>
      {value.action === "link" && (
        <Field label="Link (path or https://…)">
          <TextInput value={value.href} placeholder="/courses or https://…" onChange={(v) => onChange({ ...value, href: v })} />
        </Field>
      )}
    </div>
  );
}
