"use client";

import { POINT_DISTRIBUTION, type AnswerKeyItem } from "@/lib/gnahatum/constants";
import { QUESTION_TYPES } from "@/lib/gnahatum/import";

/**
 * The 15-question review grid.
 *
 * Shared by the importer and the test manager so the two cannot drift: an
 * answer key edited in either place is held to the same shape, and the points
 * column is display-only everywhere because the distribution is fixed by
 * question number and the scorer clamps to it regardless.
 */
export function AnswerKeyEditor({
  items,
  onChange,
}: {
  items: AnswerKeyItem[];
  onChange: (number: number, patch: Partial<AnswerKeyItem>) => void;
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.number}
          className={`border rounded-md p-3 ${item.answer.trim() ? "" : "border-red-300 bg-red-50"}`}
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm font-semibold text-gray-900 w-14">Q{item.number}</span>
            <span className="text-xs text-gray-500 w-16">{POINT_DISTRIBUTION[item.number]} pts</span>
            <select
              value={item.type}
              onChange={(e) => onChange(item.number, { type: e.target.value as AnswerKeyItem["type"] })}
              className="border rounded-md px-2 py-1 text-xs"
            >
              {QUESTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {!item.answer.trim() && (
              <span className="text-xs text-red-600 font-medium">needs an answer</span>
            )}
          </div>

          <textarea
            value={item.answer}
            onChange={(e) => onChange(item.number, { answer: e.target.value })}
            rows={2}
            placeholder="Correct answer"
            className="w-full border rounded-md px-2 py-1.5 text-sm"
          />

          <input
            value={(item.accepted_variants ?? []).join(" | ")}
            onChange={(e) =>
              onChange(item.number, {
                accepted_variants: e.target.value
                  .split("|")
                  .map((v) => v.trim())
                  .filter(Boolean),
              })
            }
            placeholder="Also accepted, separated by |"
            className="mt-2 w-full border rounded-md px-2 py-1.5 text-xs"
          />

          <input
            value={item.scoring_notes ?? ""}
            onChange={(e) => onChange(item.number, { scoring_notes: e.target.value })}
            placeholder="Scoring note, e.g. 2 x 0,5 միավոր"
            className="mt-2 w-full border rounded-md px-2 py-1.5 text-xs"
          />
        </div>
      ))}
    </div>
  );
}
