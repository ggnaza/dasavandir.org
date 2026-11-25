"use client";

import { useState } from "react";
import { RichText } from "./rich-text";
import {
  ANSWER_TYPES,
  splitKeyCell,
  validateCorrect,
  type AnswerType,
  type Choice,
  type Correct,
  type ScoringMode,
} from "@/lib/attestation-core";

export interface EditableQuestion {
  id?: string;
  number: string;
  answer_type: AnswerType;
  prompt: string;
  options: Choice[];
  match_slots: Choice[];
  passage_id: string | null;
  image_path: string | null;
  correct: Correct | null;
  points: number;
  scoring: ScoringMode;
  needs_review: boolean;
  review_note: string | null;
}

export const EMPTY_QUESTION: EditableQuestion = {
  number: "",
  answer_type: "single",
  prompt: "",
  options: [1, 2, 3, 4].map((n) => ({ id: String(n), text: "" })),
  match_slots: [],
  passage_id: null,
  image_path: null,
  correct: null,
  points: 1,
  scoring: "all_or_nothing",
  needs_review: false,
  review_note: null,
};

const TYPE_LABEL: Record<AnswerType, string> = {
  single: "Single choice",
  multi: "Multiple choice (set)",
  order: "Ordering",
  match: "Matching",
  numeric: "Number",
  short_text: "Short text",
};

function ChoiceList({ label, items, onChange }: { label: string; items: Choice[]; onChange: (c: Choice[]) => void }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-gray-600">{label}</p>
      {items.map((c, i) => (
        <div key={i} className="flex gap-2">
          <input
            className="border rounded px-2 py-1 w-14 text-sm"
            value={c.id}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, id: e.target.value } : x)))}
          />
          <textarea
            rows={1}
            className="border rounded px-2 py-1 flex-1 text-sm"
            value={c.text}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
          />
          <button type="button" className="text-gray-400 hover:text-red-600 px-1" onClick={() => onChange(items.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-xs text-violet-700 underline"
        onClick={() => onChange([...items, { id: String(items.length + 1), text: "" }])}
      >
        + add
      </button>
    </div>
  );
}

/** Edit form for one question, including its correct answer — the manual path for anything import missed. */
export function QuestionEditor({
  initial,
  passages,
  figureUrl,
  onSaved,
  onCancel,
  saveUrl,
  method,
}: {
  initial: EditableQuestion;
  passages: { id: string; label: string | null }[];
  figureUrl: string | null;
  onSaved: () => void;
  onCancel: () => void;
  saveUrl: string;
  method: "POST" | "PATCH";
}) {
  const [q, setQ] = useState<EditableQuestion>(initial);
  const [preview, setPreview] = useState<string | null>(figureUrl);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof EditableQuestion>(k: K, v: EditableQuestion[K]) => setQ((p) => ({ ...p, [k]: v }));
  const hasOptions = q.answer_type !== "numeric" && q.answer_type !== "short_text";
  const issues = validateCorrect(q);

  async function upload(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/attestation/figures", { method: "POST", body: fd });
    const body = (await res.json()) as { path?: string; url?: string; error?: string };
    if (!res.ok || !body.path) setError(body.error ?? "Upload failed");
    else {
      set("image_path", body.path);
      setPreview(body.url ?? null);
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch(saveUrl, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...q, id: undefined, points: Number(q.points) || 1 }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) setError(body.error ?? "Save failed");
    else onSaved();
  }

  const correctEditor = () => {
    const ids = q.options.map((o) => o.id);
    switch (q.answer_type) {
      case "single":
        return (
          <select className="border rounded px-2 py-1 text-sm" value={typeof q.correct === "string" ? q.correct : ""} onChange={(e) => set("correct", e.target.value || null)}>
            <option value="">— not set —</option>
            {ids.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        );
      case "multi": {
        const sel = Array.isArray(q.correct) ? q.correct : [];
        return (
          <div className="flex flex-wrap gap-3">
            {ids.map((id) => (
              <label key={id} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={sel.includes(id)}
                  onChange={() => set("correct", sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id])}
                />
                {id}
              </label>
            ))}
          </div>
        );
      }
      case "order":
        return (
          <input
            className="border rounded px-2 py-1 text-sm w-64"
            placeholder="e.g. 3,2,5,4,1"
            defaultValue={Array.isArray(q.correct) ? q.correct.join(",") : ""}
            onChange={(e) => set("correct", e.target.value.trim() ? splitKeyCell(e.target.value) : null)}
          />
        );
      case "match": {
        const map = q.correct && typeof q.correct === "object" && !Array.isArray(q.correct) ? q.correct : {};
        return (
          <div className="flex flex-wrap gap-3">
            {q.match_slots.map((s) => (
              <label key={s.id} className="flex items-center gap-1 text-sm">
                {s.id} →
                <select
                  className="border rounded px-1 py-0.5"
                  value={map[s.id] ?? ""}
                  onChange={(e) => {
                    const next = { ...map };
                    if (e.target.value) next[s.id] = e.target.value;
                    else delete next[s.id];
                    set("correct", Object.keys(next).length ? next : null);
                  }}
                >
                  <option value="">—</option>
                  {ids.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        );
      }
      default:
        return (
          <input
            className="border rounded px-2 py-1 text-sm w-64"
            placeholder="accepted answers, separated by |"
            defaultValue={Array.isArray(q.correct) ? q.correct.join(" | ") : ""}
            onChange={(e) => {
              const vals = e.target.value.split("|").map((s) => s.trim()).filter(Boolean);
              set("correct", vals.length ? vals : null);
            }}
          />
        );
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-violet-200 bg-white p-4">
      <div className="flex flex-wrap gap-3">
        <label className="text-sm">
          No.
          <input className="border rounded px-2 py-1 ml-2 w-20" value={q.number} onChange={(e) => set("number", e.target.value)} />
        </label>
        <label className="text-sm">
          Type
          <select
            className="border rounded px-2 py-1 ml-2"
            value={q.answer_type}
            onChange={(e) => setQ((p) => ({ ...p, answer_type: e.target.value as AnswerType, correct: null }))}
          >
            {ANSWER_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Passage
          <select className="border rounded px-2 py-1 ml-2 max-w-[14rem]" value={q.passage_id ?? ""} onChange={(e) => set("passage_id", e.target.value || null)}>
            <option value="">— none —</option>
            {passages.map((p, i) => (
              <option key={p.id} value={p.id}>
                {p.label || `Passage ${i + 1}`}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Points
          <input type="number" min={0.5} step={0.5} className="border rounded px-2 py-1 ml-2 w-20" value={q.points} onChange={(e) => set("points", Number(e.target.value))} />
        </label>
        <label className="text-sm">
          Scoring
          <select className="border rounded px-2 py-1 ml-2" value={q.scoring} onChange={(e) => set("scoring", e.target.value as ScoringMode)}>
            <option value="all_or_nothing">All or nothing</option>
            <option value="partial">Partial credit</option>
          </select>
        </label>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-600">Question text (Markdown, math as $…$, &lt;u&gt;underline&lt;/u&gt;)</p>
          <textarea rows={6} className="border rounded px-2 py-1 w-full text-sm font-mono" value={q.prompt} onChange={(e) => set("prompt", e.target.value)} />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-600">Preview</p>
          <div className="border rounded p-2 min-h-[6rem] bg-gray-50">
            <RichText text={q.prompt || "_empty_"} />
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium text-gray-600">Figure (optional — for diagrams, graphs, structures)</p>
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element -- signed URL from the private bucket
          <img src={preview} alt="" className="max-h-48 rounded border" />
        )}
        <div className="flex items-center gap-3">
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="text-sm" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
          {q.image_path && (
            <button type="button" className="text-xs text-red-600 underline" onClick={() => { set("image_path", null); setPreview(null); }}>
              Remove figure
            </button>
          )}
        </div>
      </div>

      {hasOptions && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChoiceList label="Options (label + text)" items={q.options} onChange={(c) => set("options", c)} />
          {q.answer_type === "match" && <ChoiceList label="Items to match (A, B, …)" items={q.match_slots} onChange={(c) => set("match_slots", c)} />}
        </div>
      )}

      <div className="space-y-1">
        <p className="text-xs font-medium text-gray-600">Correct answer</p>
        {correctEditor()}
        {issues.length > 0 && <p className="text-xs text-amber-700">{issues.join(" · ")}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={q.needs_review} onChange={(e) => set("needs_review", e.target.checked)} />
          Needs review (blocks publishing)
        </label>
        <input
          className="border rounded px-2 py-1 text-sm flex-1 min-w-[12rem]"
          placeholder="Review note"
          value={q.review_note ?? ""}
          onChange={(e) => set("review_note", e.target.value || null)}
        />
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={() => void save()} className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm disabled:opacity-50">
          Save question
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg border text-sm">
          Cancel
        </button>
      </div>
    </div>
  );
}
