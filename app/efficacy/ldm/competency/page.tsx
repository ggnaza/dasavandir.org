"use client";
import { useEffect, useState } from "react";
import { COMPETENCY_CATEGORIES, SCORE_SCALE } from "@/lib/efficacy/constants";
import { ScoreBadge, scoreColorClass } from "@/components/efficacy/score-segment";

interface Teacher {
  teacher_id: string;
  full_name: string;
  email: string;
}

interface CompetencyScore {
  competency: string;
  score: number | null;
  notes: string;
}

interface CategoryScores {
  category: string;
  scores: CompetencyScore[];
}

interface MatrixEntry {
  competency: string;
  category: string;
  scores: { evaluation_id: string; score: number; period: string; created_at: string }[];
  trend: { direction: string; magnitude: number } | null;
  latestScore: number | null;
}

export default function CompetencyPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [matrix, setMatrix] = useState<MatrixEntry[]>([]);
  const [period, setPeriod] = useState("");
  const [formScores, setFormScores] = useState<CategoryScores[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/efficacy/ldm/teachers")
      .then((r) => r.json())
      .then((data) => setTeachers(Array.isArray(data) ? data : []));
  }, []);

  useEffect(() => {
    if (!selectedTeacher) return;
    setLoading(true);
    fetch(`/api/efficacy/ldm/competency-matrix?teacher_id=${selectedTeacher}`)
      .then((r) => r.json())
      .then((data) => setMatrix(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [selectedTeacher]);

  useEffect(() => {
    setFormScores(
      COMPETENCY_CATEGORIES.map((cat) => ({
        category: cat.key,
        scores: cat.competencies.map((comp) => ({
          competency: comp,
          score: null,
          notes: "",
        })),
      }))
    );
  }, [selectedTeacher]);

  function updateScore(catIdx: number, compIdx: number, score: number | null) {
    setFormScores((prev) =>
      prev.map((cat, ci) =>
        ci !== catIdx
          ? cat
          : {
              ...cat,
              scores: cat.scores.map((s, si) =>
                si !== compIdx ? s : { ...s, score }
              ),
            }
      )
    );
  }

  function updateNotes(catIdx: number, compIdx: number, notes: string) {
    setFormScores((prev) =>
      prev.map((cat, ci) =>
        ci !== catIdx
          ? cat
          : {
              ...cat,
              scores: cat.scores.map((s, si) =>
                si !== compIdx ? s : { ...s, notes }
              ),
            }
      )
    );
  }

  async function handleSave() {
    if (!selectedTeacher) return;
    setSaving(true);
    setMessage(null);
    try {
      const scores: Record<string, { score: number; notes: string }> = {};
      for (const cat of formScores) {
        for (const s of cat.scores) {
          if (s.score !== null) {
            scores[s.competency] = { score: s.score, notes: s.notes };
          }
        }
      }
      const res = await fetch("/api/efficacy/ldm/evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacher_id: selectedTeacher,
          period: period || undefined,
          scores,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setMessage({ type: "success", text: "Evaluation saved" });
      // Refresh matrix
      const matrixRes = await fetch(`/api/efficacy/ldm/competency-matrix?teacher_id=${selectedTeacher}`);
      const matrixData = await matrixRes.json();
      setMatrix(Array.isArray(matrixData) ? matrixData : []);
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Competency Evaluations</h1>
        <p className="text-gray-600 mt-1">Evaluate teacher leadership competencies (18 competencies, 0-5 scale)</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Teacher</label>
          <select
            value={selectedTeacher}
            onChange={(e) => setSelectedTeacher(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="">Select teacher...</option>
            {teachers.map((t) => (
              <option key={t.teacher_id} value={t.teacher_id}>
                {t.full_name || t.email}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Period</label>
          <input
            type="text"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            placeholder="e.g. Q1 2026"
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>
      </div>

      {message && (
        <div
          className={`p-3 rounded-lg text-sm ${
            message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {selectedTeacher && loading && (
        <div className="text-center py-8 text-gray-500">Loading matrix...</div>
      )}

      {selectedTeacher && !loading && matrix.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Matrix</h2>
          <div className="space-y-4">
            {COMPETENCY_CATEGORIES.map((cat) => {
              const catEntries = matrix.filter((m) => m.category === cat.key);
              if (catEntries.length === 0) return null;
              return (
                <div key={cat.key} className="bg-white rounded-lg border p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">{cat.name}</h3>
                  <div className="space-y-2">
                    {catEntries.map((entry) => (
                      <div key={entry.competency} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{entry.competency}</span>
                        <div className="flex items-center gap-3">
                          <ScoreBadge value={entry.latestScore} />
                          {entry.trend && (
                            <span className={`text-xs ${
                              entry.trend.direction === "up" ? "text-green-600" :
                              entry.trend.direction === "down" ? "text-red-600" : "text-gray-400"
                            }`}>
                              {entry.trend.direction === "up" ? "↑" : entry.trend.direction === "down" ? "↓" : "→"}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedTeacher && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">New Evaluation</h2>
          <div className="space-y-6">
            {COMPETENCY_CATEGORIES.map((cat, catIdx) => (
              <div key={cat.key} className="bg-white rounded-lg border p-4">
                <h3 className="font-semibold text-gray-900 mb-3">{cat.name}</h3>
                <div className="space-y-4">
                  {cat.competencies.map((comp, compIdx) => (
                    <div key={comp} className="border-l-2 border-gray-100 pl-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-700">{comp}</span>
                        <select
                          value={formScores[catIdx]?.scores[compIdx]?.score ?? ""}
                          onChange={(e) =>
                            updateScore(catIdx, compIdx, e.target.value === "" ? null : parseInt(e.target.value))
                          }
                          className={`border rounded px-2 py-1 text-sm w-20 ${
                            scoreColorClass(formScores[catIdx]?.scores[compIdx]?.score ?? null)
                          }`}
                        >
                          <option value="">-</option>
                          {SCORE_SCALE.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.value} - {s.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <textarea
                        value={formScores[catIdx]?.scores[compIdx]?.notes ?? ""}
                        onChange={(e) => updateNotes(catIdx, compIdx, e.target.value)}
                        placeholder="Notes..."
                        rows={1}
                        className="w-full border rounded px-2 py-1 text-sm resize-y"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Save Evaluation"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
