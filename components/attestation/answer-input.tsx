"use client";

import { RichText } from "./rich-text";
import type { AnswerType, Choice } from "@/lib/attestation-core";

export type AnswerValue = string | string[] | Record<string, string> | null;

const HINT: Record<AnswerType, string> = {
  single: "Ընտրեք մեկ պատասխան",
  multi: "Ընտրեք բոլոր ճիշտ պատասխանները",
  order: "Դասավորեք ճիշտ հերթականությամբ (սլաքներով)",
  match: "Յուրաքանչյուրի համար ընտրեք համապատասխանը",
  numeric: "Գրեք թիվը",
  short_text: "Գրեք պատասխանը",
};

/**
 * One answer control per answer type. Used by the test runner (editable) and the
 * results view (read-only, with the correct answer highlighted).
 */
export function AnswerInput({
  type,
  options,
  slots,
  value,
  onChange,
  disabled = false,
  correct,
}: {
  type: AnswerType;
  options: Choice[];
  slots: Choice[];
  value: AnswerValue;
  onChange?: (v: AnswerValue) => void;
  disabled?: boolean;
  /** When given (staff views), correct choices are marked green. */
  correct?: AnswerValue;
}) {
  const set = (v: AnswerValue) => onChange?.(v);
  const isCorrectOpt = (id: string) =>
    correct == null ? false : typeof correct === "string" ? correct === id : Array.isArray(correct) ? correct.includes(id) : false;

  if (type === "single" || type === "multi") {
    const selected = type === "single" ? (typeof value === "string" ? [value] : []) : Array.isArray(value) ? value : [];
    const toggle = (id: string) => {
      if (type === "single") set(id);
      else set(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
    };
    return (
      <div className="space-y-2">
        <p className="text-xs text-gray-500">{HINT[type]}</p>
        {options.map((o) => (
          <label
            key={o.id}
            className={`flex items-start gap-3 rounded-lg border px-3 py-2 ${disabled ? "" : "cursor-pointer hover:bg-gray-50"} ${
              selected.includes(o.id) ? "border-violet-500 bg-violet-50" : "border-gray-200"
            } ${isCorrectOpt(o.id) ? "ring-2 ring-green-500" : ""}`}
          >
            <input
              type={type === "single" ? "radio" : "checkbox"}
              className="mt-1"
              checked={selected.includes(o.id)}
              disabled={disabled}
              onChange={() => toggle(o.id)}
            />
            <span className="font-medium text-gray-500 w-6 shrink-0">{o.id})</span>
            <RichText text={o.text} inline />
          </label>
        ))}
      </div>
    );
  }

  if (type === "order") {
    const current = Array.isArray(value) && value.length ? value : options.map((o) => o.id);
    const touched = Array.isArray(value) && value.length > 0;
    const byId = new Map(options.map((o) => [o.id, o]));
    const move = (i: number, d: number) => {
      const next = [...current];
      const j = i + d;
      if (j < 0 || j >= next.length) return;
      [next[i], next[j]] = [next[j]!, next[i]!];
      set(next);
    };
    return (
      <div className="space-y-2">
        <p className="text-xs text-gray-500">{HINT.order}</p>
        <ol className="space-y-2">
          {current.map((id, i) => (
            <li key={id} className="flex items-start gap-2 rounded-lg border border-gray-200 px-3 py-2">
              <span className="text-gray-400 w-5 shrink-0">{i + 1}.</span>
              <span className="font-medium text-gray-500 w-6 shrink-0">{id})</span>
              <div className="flex-1">
                <RichText text={byId.get(id)?.text ?? ""} inline />
              </div>
              {!disabled && (
                <span className="flex flex-col">
                  <button type="button" aria-label="Վեր" className="px-2 text-gray-500 hover:text-gray-900" onClick={() => move(i, -1)}>
                    ▲
                  </button>
                  <button type="button" aria-label="Վար" className="px-2 text-gray-500 hover:text-gray-900" onClick={() => move(i, 1)}>
                    ▼
                  </button>
                </span>
              )}
            </li>
          ))}
        </ol>
        {!disabled && !touched && (
          <button type="button" className="text-sm text-violet-700 underline" onClick={() => set(current)}>
            Հաստատել այս հերթականությունը
          </button>
        )}
        {correct && Array.isArray(correct) && <p className="text-sm text-green-700">Ճիշտ՝ {correct.join(" → ")}</p>}
      </div>
    );
  }

  if (type === "match") {
    const map = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const correctMap = correct && typeof correct === "object" && !Array.isArray(correct) ? correct : null;
    return (
      <div className="space-y-3">
        <p className="text-xs text-gray-500">{HINT.match}</p>
        <div className="rounded-lg border border-gray-200 p-3 space-y-1 bg-gray-50">
          {options.map((o) => (
            <div key={o.id} className="flex gap-2 text-sm">
              <span className="font-medium text-gray-500 w-6 shrink-0">{o.id})</span>
              <RichText text={o.text} inline />
            </div>
          ))}
        </div>
        {slots.map((s) => (
          <div key={s.id} className="flex items-start gap-3">
            <span className="font-medium text-gray-700 w-6 shrink-0">{s.id}</span>
            <div className="flex-1">
              <RichText text={s.text} inline />
            </div>
            <select
              className="border rounded-md px-2 py-1 text-sm"
              value={map[s.id] ?? ""}
              disabled={disabled}
              onChange={(e) => {
                const next = { ...map };
                if (e.target.value) next[s.id] = e.target.value;
                else delete next[s.id];
                set(next);
              }}
            >
              <option value="">—</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.id}
                </option>
              ))}
            </select>
            {correctMap && <span className="text-sm text-green-700 w-10">✓{correctMap[s.id] ?? "—"}</span>}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">{HINT[type]}</p>
      <input
        type="text"
        inputMode={type === "numeric" ? "decimal" : "text"}
        className="border rounded-lg px-3 py-2 w-full max-w-xs"
        value={typeof value === "string" ? value : ""}
        disabled={disabled}
        onChange={(e) => set(e.target.value)}
      />
      {Array.isArray(correct) && <p className="text-sm text-green-700">Ճիշտ՝ {correct.join(" / ")}</p>}
    </div>
  );
}
