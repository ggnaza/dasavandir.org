"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Question = {
  question: string;
  options: string[];
  correct: number;
};

type Quiz = { id: string; questions: Question[] };

export function QuizEditor({ lessonId, existing }: { lessonId: string; existing: Quiz | null }) {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>(existing?.questions ?? []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [genWarnings, setGenWarnings] = useState<string[]>([]);
  const [genCount, setGenCount] = useState(5);
  const [deleting, setDeleting] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    setGenError("");
    setGenWarnings([]);
    const res = await fetch("/api/ai-builder/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId, count: genCount }),
    });
    if (!res.ok) {
      setGenError(await res.text());
      setGenerating(false);
      return;
    }
    const { questions: generated, warnings } = await res.json();
    setQuestions((prev) => [...prev, ...generated]);
    if (warnings?.length) setGenWarnings(warnings);
    setGenerating(false);
  }

  function addQuestion() {
    setQuestions([...questions, { question: "", options: ["", "", "", ""], correct: 0 }]);
  }

  function removeQuestion(i: number) {
    setQuestions(questions.filter((_, idx) => idx !== i));
  }

  function updateQuestion(i: number, field: keyof Question, value: string | number) {
    const updated = [...questions];
    (updated[i] as any)[field] = value;
    setQuestions(updated);
  }

  function updateOption(qi: number, oi: number, value: string) {
    const updated = [...questions];
    updated[qi].options[oi] = value;
    setQuestions(updated);
  }

  async function handleDelete() {
    if (!existing || !confirm("Delete this quiz? This cannot be undone.")) return;
    setDeleting(true);
    const supabase = createClient();
    await supabase.from("quizzes").delete().eq("id", existing.id);
    router.refresh();
  }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    if (existing) {
      await supabase.from("quizzes").update({ questions }).eq("id", existing.id);
    } else {
      await supabase.from("quizzes").insert({ lesson_id: lessonId, questions });
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-6">

      {/* AI generate panel */}
      <div className="bg-brand-50 border border-brand-200 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="font-semibold text-brand-900 text-sm">✦ Generate with AI</p>
            <p className="text-xs text-brand-700 mt-0.5">
              AI reads this lesson's content and creates quiz questions automatically.
              {questions.length > 0 && " Generated questions are added to existing ones."}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
            <div className="flex items-center gap-2">
              <label className="text-xs text-brand-700 font-medium">Questions:</label>
              <select
                value={genCount}
                onChange={(e) => setGenCount(Number(e.target.value))}
                className="border border-brand-300 rounded-lg px-2 py-1 text-sm bg-white"
              >
                {[3, 5, 7, 10].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
            >
              {generating ? "Generating…" : "Generate"}
            </button>
          </div>
        </div>
        {genError && <p className="text-red-600 text-xs mt-3">{genError}</p>}
        {generating && (
          <p className="text-xs text-brand-600 mt-3 animate-pulse">Reading lesson content, slides, and documents…</p>
        )}
        {genWarnings.length > 0 && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
            <p className="text-xs font-medium text-amber-800">⚠ Some content sources could not be read:</p>
            {genWarnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-700">• {w}</p>
            ))}
          </div>
        )}
      </div>

      {/* Question list */}
      {questions.length === 0 && (
        <div className="bg-white border rounded-xl p-8 text-center text-gray-500 text-sm">
          No questions yet. Generate with AI or add manually below.
        </div>
      )}

      {questions.map((q, qi) => (
        <div key={qi} className="bg-white border rounded-xl p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Question {qi + 1}</label>
              <input
                type="text"
                value={q.question}
                onChange={(e) => updateQuestion(qi, "question", e.target.value)}
                placeholder="Enter your question"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <button
              onClick={() => removeQuestion(qi)}
              className="text-red-400 hover:text-red-600 text-sm mt-5 shrink-0"
            >
              Remove
            </button>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-500">Options — select the correct answer</label>
            {q.options.map((opt, oi) => (
              <div key={oi} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`correct-${qi}`}
                  checked={q.correct === oi}
                  onChange={() => updateQuestion(qi, "correct", oi)}
                  className="shrink-0"
                />
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => updateOption(qi, oi, e.target.value)}
                  placeholder={`Option ${oi + 1}`}
                  className={`flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${q.correct === oi ? "border-green-400 bg-green-50" : ""}`}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={addQuestion} className="text-sm border rounded-lg px-4 py-2 hover:bg-gray-50">
            + Add question manually
          </button>
          {existing && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-sm text-red-400 hover:text-red-600 disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete quiz"}
            </button>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving || questions.length === 0}
          className="bg-brand-600 text-white px-5 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 text-sm font-medium"
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save quiz"}
        </button>
      </div>
    </div>
  );
}
