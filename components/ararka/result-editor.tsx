"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { COGNITIVE_LEVELS, POINT_DISTRIBUTION } from "@/lib/ararka/constants";
import type { ScoredItem } from "@/lib/ararka/constants";

interface Props {
  resultId: string;
  items: ScoredItem[];
  aiItems: ScoredItem[];
  wasCorrected: boolean;
}

export function ResultEditor({ resultId, items, aiItems, wasCorrected }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [editedScores, setEditedScores] = useState<Record<number, number>>({});
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEditing = useCallback(() => {
    const scores: Record<number, number> = {};
    items.forEach((item) => {
      scores[item.number] = item.awarded_points;
    });
    setEditedScores(scores);
    setReasons({});
    setEditing(true);
    setError(null);
  }, [items]);

  const handleSave = useCallback(async () => {
    const corrections = items
      .filter((item) => editedScores[item.number] !== item.awarded_points)
      .map((item) => ({
        question_number: item.number,
        teacher_score: editedScores[item.number] ?? item.awarded_points,
        reason: reasons[item.number] || undefined,
      }));

    if (corrections.length === 0) {
      setEditing(false);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/ararka/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result_id: resultId, corrections }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(body.error ?? "Failed to save corrections");
      }

      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [resultId, items, editedScores, reasons, router]);

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <h2 className="font-semibold text-gray-900">Question Breakdown</h2>
        <div className="flex items-center gap-2">
          {!editing && (
            <button
              onClick={startEditing}
              className="px-3 py-1.5 rounded-md bg-yellow-100 text-yellow-800 text-sm font-medium hover:bg-yellow-200 transition-colors"
            >
              Correct Scores
            </button>
          )}
          {editing && (
            <>
              <button
                onClick={() => setEditing(false)}
                className="px-3 py-1.5 rounded-md bg-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={saving}
                className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Corrections"}
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left">
              <th className="py-3 px-4 font-medium text-gray-500">Q#</th>
              <th className="py-3 px-4 font-medium text-gray-500">Level</th>
              <th className="py-3 px-4 font-medium text-gray-500">Student Answer</th>
              <th className="py-3 px-4 font-medium text-gray-500">Correct Answer</th>
              <th className="py-3 px-4 font-medium text-gray-500">
                {editing ? "AI / Your Score" : wasCorrected ? "Score (corrected)" : "Score"}
              </th>
              <th className="py-3 px-4 font-medium text-gray-500">Confidence</th>
              {editing ? (
                <th className="py-3 px-4 font-medium text-gray-500">Reason</th>
              ) : (
                <th className="py-3 px-4 font-medium text-gray-500">Note</th>
              )}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const level = Object.entries(COGNITIVE_LEVELS).find(([, l]) =>
                (l.questions as readonly number[]).includes(item.number),
              );
              const maxPts = POINT_DISTRIBUTION[item.number] ?? 0;
              const aiItem = aiItems.find((a) => a.number === item.number);
              const changed = editing && editedScores[item.number] !== item.awarded_points;
              const tcCorrected = "teacher_corrected" in item && item.teacher_corrected;

              return (
                <tr
                  key={item.number}
                  className={`border-b ${changed ? "bg-blue-50" : tcCorrected ? "bg-yellow-50" : item.awarded_points === maxPts ? "" : item.awarded_points > 0 ? "bg-yellow-50/50" : "bg-red-50"}`}
                >
                  <td className="py-3 px-4 font-medium">{item.number}</td>
                  <td className="py-3 px-4 text-gray-500 text-xs">
                    {level ? level[1].label_en : "—"}
                  </td>
                  <td className="py-3 px-4 max-w-[200px]">
                    <span className="whitespace-pre-wrap break-words">{item.extracted_answer}</span>
                  </td>
                  <td className="py-3 px-4 max-w-[200px]">
                    <span className="whitespace-pre-wrap break-words">{item.correct_answer}</span>
                  </td>
                  <td className="py-3 px-4">
                    {editing ? (
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400 text-xs">{aiItem?.awarded_points ?? item.awarded_points}</span>
                        <span className="text-gray-300">&rarr;</span>
                        <input
                          type="number"
                          min={0}
                          max={maxPts}
                          step={0.25}
                          value={editedScores[item.number] ?? item.awarded_points}
                          onChange={(e) =>
                            setEditedScores((prev) => ({
                              ...prev,
                              [item.number]: parseFloat(e.target.value) || 0,
                            }))
                          }
                          className={`w-16 px-1.5 py-1 border rounded text-sm text-center ${changed ? "border-blue-400 bg-blue-50" : "border-gray-300"}`}
                        />
                        <span className="text-gray-400 text-xs">/ {maxPts}</span>
                      </div>
                    ) : (
                      <>
                        <span className={`font-medium ${item.awarded_points === maxPts ? "text-green-600" : item.awarded_points > 0 ? "text-yellow-600" : "text-red-600"}`}>
                          {item.awarded_points}
                        </span>
                        <span className="text-gray-400"> / {maxPts}</span>
                        {tcCorrected && aiItem && aiItem.awarded_points !== item.awarded_points && (
                          <span className="ml-1 text-xs text-gray-400 line-through">
                            (AI: {aiItem.awarded_points})
                          </span>
                        )}
                      </>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <div className="w-14 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${item.confidence >= 0.8 ? "bg-green-500" : item.confidence >= 0.5 ? "bg-yellow-500" : "bg-red-500"}`}
                          style={{ width: `${item.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400">
                        {Math.round(item.confidence * 100)}%
                      </span>
                    </div>
                  </td>
                  {editing ? (
                    <td className="py-3 px-4">
                      {changed && (
                        <input
                          type="text"
                          placeholder="Reason for correction"
                          value={reasons[item.number] ?? ""}
                          onChange={(e) =>
                            setReasons((prev) => ({
                              ...prev,
                              [item.number]: e.target.value,
                            }))
                          }
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                        />
                      )}
                    </td>
                  ) : (
                    <td className="py-3 px-4 text-xs text-gray-500 max-w-[250px]">
                      {item.explanation}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
