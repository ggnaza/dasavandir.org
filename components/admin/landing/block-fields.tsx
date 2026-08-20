"use client";

import type { Lang } from "@/lib/i18n";
import type { Block } from "@/lib/landing/blocks";
import { LessonContentEditor } from "@/components/lesson-content-editor";
import { Field, LocalizedInput, ColorInput, ImageInput, ButtonEditor, TextInput } from "./field-inputs";

type Props = { block: Block; lang: Lang; onChange: (data: Block["data"]) => void };

const addBtn = "text-xs font-medium text-brand-600 hover:text-brand-700";
const removeBtn = "text-xs text-red-500 hover:text-red-600";

export function BlockFields({ block, lang, onChange }: Props) {
  switch (block.type) {
    case "hero": {
      const d = block.data;
      return (
        <div className="space-y-3">
          <LocalizedInput label="Eyebrow / tag" value={d.tag} lang={lang} onChange={(tag) => onChange({ ...d, tag })} />
          <LocalizedInput label="Title" value={d.title} lang={lang} onChange={(title) => onChange({ ...d, title })} />
          <LocalizedInput label="Title accent (coloured line)" value={d.titleAccent} lang={lang} onChange={(titleAccent) => onChange({ ...d, titleAccent })} />
          <LocalizedInput label="Description" value={d.desc} lang={lang} multiline onChange={(desc) => onChange({ ...d, desc })} />
          <div className="grid grid-cols-2 gap-2">
            <ColorInput label="Background" value={d.bgColor} onChange={(bgColor) => onChange({ ...d, bgColor })} />
            <ColorInput label="Accent" value={d.accentColor} onChange={(accentColor) => onChange({ ...d, accentColor })} />
          </div>
          <ButtonEditor label="Primary button" value={d.primary} lang={lang} onChange={(primary) => onChange({ ...d, primary })} />
          <ButtonEditor label="Secondary button" value={d.secondary} lang={lang} onChange={(secondary) => onChange({ ...d, secondary })} />
        </div>
      );
    }
    case "stats": {
      const d = block.data;
      const setItem = (i: number, patch: Partial<typeof d.items[number]>) =>
        onChange({ ...d, items: d.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
      return (
        <div className="space-y-3">
          <ColorInput label="Background" value={d.bgColor} onChange={(bgColor) => onChange({ ...d, bgColor })} />
          {d.items.map((it, i) => (
            <div key={i} className="rounded-lg border border-gray-200 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-600">Stat {i + 1}</span>
                <button className={removeBtn} onClick={() => onChange({ ...d, items: d.items.filter((_, j) => j !== i) })}>Remove</button>
              </div>
              <LocalizedInput label="Number" value={it.number} lang={lang} onChange={(number) => setItem(i, { number })} />
              <LocalizedInput label="Label" value={it.label} lang={lang} onChange={(label) => setItem(i, { label })} />
            </div>
          ))}
          {d.items.length < 8 && (
            <button className={addBtn} onClick={() => onChange({ ...d, items: [...d.items, { number: { en: "", hy: "" }, label: { en: "", hy: "" } }] })}>+ Add stat</button>
          )}
        </div>
      );
    }
    case "features": {
      const d = block.data;
      const setCard = (i: number, patch: Partial<typeof d.cards[number]>) =>
        onChange({ ...d, cards: d.cards.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
      return (
        <div className="space-y-3">
          <LocalizedInput label="Section title" value={d.title} lang={lang} onChange={(title) => onChange({ ...d, title })} />
          <LocalizedInput label="Section subtitle" value={d.subtitle} lang={lang} onChange={(subtitle) => onChange({ ...d, subtitle })} />
          <ColorInput label="Background" value={d.bgColor} onChange={(bgColor) => onChange({ ...d, bgColor })} />
          {d.cards.map((c, i) => (
            <div key={i} className="rounded-lg border border-gray-200 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-600">Card {i + 1}</span>
                <button className={removeBtn} onClick={() => onChange({ ...d, cards: d.cards.filter((_, j) => j !== i) })}>Remove</button>
              </div>
              <div className="grid grid-cols-[70px_1fr] gap-2">
                <Field label="Icon"><TextInput value={c.icon} placeholder="✦" onChange={(icon) => setCard(i, { icon })} /></Field>
                <ColorInput label="Icon colour" value={c.color} onChange={(color) => setCard(i, { color })} />
              </div>
              <LocalizedInput label="Title" value={c.title} lang={lang} onChange={(title) => setCard(i, { title })} />
              <LocalizedInput label="Description" value={c.desc} lang={lang} multiline onChange={(desc) => setCard(i, { desc })} />
            </div>
          ))}
          {d.cards.length < 12 && (
            <button className={addBtn} onClick={() => onChange({ ...d, cards: [...d.cards, { icon: "✦", color: "#EC5328", title: { en: "", hy: "" }, desc: { en: "", hy: "" } }] })}>+ Add card</button>
          )}
        </div>
      );
    }
    case "cta": {
      const d = block.data;
      return (
        <div className="space-y-3">
          <LocalizedInput label="Title" value={d.title} lang={lang} onChange={(title) => onChange({ ...d, title })} />
          <LocalizedInput label="Description" value={d.desc} lang={lang} multiline onChange={(desc) => onChange({ ...d, desc })} />
          <ColorInput label="Background" value={d.bgColor} onChange={(bgColor) => onChange({ ...d, bgColor })} />
          <ButtonEditor label="Button" value={d.button} lang={lang} onChange={(button) => onChange({ ...d, button })} />
        </div>
      );
    }
    case "richtext": {
      const d = block.data;
      return (
        <div className="space-y-3">
          <Field label={`Content · ${lang.toUpperCase()}`}>
            <LessonContentEditor key={`${block.id}-${lang}`} value={d.html[lang]} onChange={(html) => onChange({ ...d, html: { ...d.html, [lang]: html } })} />
          </Field>
          <ColorInput label="Background" value={d.bgColor} onChange={(bgColor) => onChange({ ...d, bgColor })} />
        </div>
      );
    }
    case "image": {
      const d = block.data;
      return (
        <div className="space-y-3">
          <ImageInput label="Image" value={d.src} onChange={(src) => onChange({ ...d, src })} />
          <LocalizedInput label="Alt text" value={d.alt} lang={lang} onChange={(alt) => onChange({ ...d, alt })} />
          <LocalizedInput label="Caption" value={d.caption} lang={lang} onChange={(caption) => onChange({ ...d, caption })} />
          <Field label="Width">
            <select
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={d.width}
              onChange={(e) => onChange({ ...d, width: e.target.value as "full" | "contained" })}
            >
              <option value="contained">Contained</option>
              <option value="full">Full width</option>
            </select>
          </Field>
        </div>
      );
    }
  }
}
