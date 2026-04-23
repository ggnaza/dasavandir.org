"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Question = {
  question: string;
  options: string[];
  correct: number;
};

type Quiz = { id: string; questions: Question[] };

export function QuizEditor({ lessonId, existing }: { lessonId: string; existing: Quiz | null }) {
  const [questions, setQuestions] = useState<Question[]>(
    existing?.questions ?? []
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
      {questions.length === 0 && (
        <div className="bg-white border rounded-xl p-8 text-center text-gray-500 text-sm">
          No questions yet. Add your first question below.
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
            <label className="block text-xs font-medium text-gray-500">Options (select the correct answer)</label>
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
        <button
          onClick={addQuestion}
          className="text-sm border rounded-lg px-4 py-2 hover:bg-gray-50"
        >
          + Add question
        </button>
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
