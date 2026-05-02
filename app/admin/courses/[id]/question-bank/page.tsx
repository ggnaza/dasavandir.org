"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type Lesson = { id: string; title: string; order: number };
type Question = { id: string; question: string; options: string[]; correct: number; lesson_id: string | null };

const BLANK_Q = { question: "", options: ["", "", "", ""], correct: 0 };

export default function QuestionBankPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<string>("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [newQ, setNewQ] = useState(BLANK_Q);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // AI generation
  const [aiMode, setAiMode] = useState(false);
  const [aiCount, setAiCount] = useState(5);
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiSuccess, setAiSuccess] = useState("");

  useEffect(() => {
    supabase
      .from("lessons")
      .select("id, title, order")
      .eq("course_id", params.id)
      .order("order")
      .then(({ data }) => setLessons(data ?? []));
  }, []);

  useEffect(() => {
    if (!selectedLessonId) { setQuestions([]); return; }
    loadQuestions();
  }, [selectedLessonId]);

  async function loadQuestions() {
    setLoading(true);
    const { data } = await supabase
      .from("question_bank")
      .select("id, question, options, correct, lesson_id")
      .eq("lesson_id", selectedLessonId)
      .order("created_at", { ascending: false });
    setQuestions((data ?? []) as Question[]);
    setLoading(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newQ.question.trim() || newQ.options.some((o) => !o.trim())) {
      setError("Fill the question and all 4 options.");
      return;
    }
    setSaving(true);
    setError("");
    const { error: err } = await supabase.from("question_bank").insert({
      course_id: params.id,
      lesson_id: selectedLessonId,
      question: newQ.question.trim(),
      options: newQ.options,
      correct: newQ.correct,
    });
    if (err) { setError(err.message); setSaving(false); return; }
    setNewQ(BLANK_Q);
    setAddMode(false);
    setSaving(false);
    loadQuestions();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this question?")) return;
    await supabase.from("question_bank").delete().eq("id", id);
    loadQuestions();
  }

  async function handleAiGenerate() {
    setGenerating(true);
    setAiError("");
    setAiSuccess("");
    const res = await fetch("/api/admin/question-bank/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lesson_id: selectedLessonId, course_id: params.id, count: aiCount }),
    });
    if (!res.ok) { setAiError(await res.text()); setGenerating(false); return; }
    const { added } = await res.json();
    setAiSuccess(`✓ ${added} questions added to the bank.`);
    setAiMode(false);
    setGenerating(false);
    loadQuestions();
  }

  const selectedLesson = lessons.find((l) => l.id === selectedLessonId);

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Question Bank</h2>
        <p className="text-sm text-gray-500">Questions are linked per lesson. Quizzes draw randomly from the bank.</p>
      </div>

      {/* Step 1: Choose lesson */}
      <div className="bg-white border rounded-xl p-5 space-y-2">
        <label className="block text-sm font-medium">Step 1 — Choose a lesson</label>
        <select
          value={selectedLessonId}
          onChange={(e) => {
            setSelectedLessonId(e.target.value);
            setAddMode(false);
            setAiMode(false);
            setAiSuccess("");
            setError("");
          }}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">— Select a lesson —</option>
          {lessons.map((l, i) => (
            <option key={l.id} value={l.id}>{i + 1}. {l.title}</option>
          ))}
        </select>
      </div>

      {/* Step 2: Questions for selected lesson */}
      {selectedLessonId && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm font-medium text-gray-700">
              {loading ? "Loading…" : `${questions.length} question${questions.length !== 1 ? "s" : ""}`} for <span className="text-brand-600">{selectedLesson?.title}</span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { setAiMode((v) => !v); setAddMode(false); setAiSuccess(""); }}
                className={`text-sm px-3 py-1.5 rounded-lg font-medium border ${aiMode ? "bg-brand-600 text-white border-brand-600" : "border-brand-400 text-brand-600 hover:bg-brand-50"}`}
              >
                ✦ Generate with AI
              </button>
              <button
                onClick={() => { setAddMode((v) => !v); setAiMode(false); }}
                className={`text-sm px-3 py-1.5 rounded-lg font-medium border ${addMode ? "bg-gray-700 text-white border-gray-700" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}
              >
                {addMode ? "Cancel" : "+ Add manually"}
              </button>
            </div>
          </div>

          {aiSuccess && <p className="text-green-600 text-sm font-medium">{aiSuccess}</p>}

          {/* AI generation panel */}
          {aiMode && (
            <div className="bg-brand-50 border border-brand-200 rounded-xl p-5 space-y-4">
              <p className="text-sm font-semibold text-brand-900">✦ AI Question Generation</p>
              <p className="text-xs text-brand-700">AI reads this lesson's content, slides, and documents to generate unique multiple-choice questions.</p>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-brand-900 shrink-0">How many questions?</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={aiCount}
                  onChange={(e) => setAiCount(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-20 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <span className="text-xs text-brand-600">(max 20)</span>
              </div>
              {aiError && <p className="text-red-600 text-xs">{aiError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleAiGenerate}
                  disabled={generating}
                  className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
                >
                  {generating ? "Generating…" : `Generate ${aiCount} questions`}
                </button>
                <button onClick={() => setAiMode(false)} className="text-sm text-gray-500 hover:underline px-2">Cancel</button>
              </div>
            </div>
          )}

          {/* Manual add form */}
          {addMode && (
            <form onSubmit={handleAdd} className="bg-white border rounded-xl p-5 space-y-4">
              <p className="text-sm font-semibold">New question</p>
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-600">Question</label>
                <input
                  type="text"
                  value={newQ.question}
                  onChange={(e) => setNewQ({ ...newQ, question: e.target.value })}
                  placeholder="Enter question text…"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-600">Options — click radio to mark correct answer</label>
                {newQ.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correct"
                      checked={newQ.correct === i}
                      onChange={() => setNewQ({ ...newQ, correct: i })}
                      className="shrink-0"
                    />
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const opts = [...newQ.options];
                        opts[i] = e.target.value;
                        setNewQ({ ...newQ, options: opts });
                      }}
                      placeholder={`Option ${i + 1}`}
                      className={`flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${newQ.correct === i ? "border-green-400 bg-green-50" : ""}`}
                    />
                  </div>
                ))}
              </div>
              {error && <p className="text-red-600 text-xs">{error}</p>}
              <button type="submit" disabled={saving} className="bg-brand-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
                {saving ? "Saving…" : "Add to bank"}
              </button>
            </form>
          )}

          {/* Question list */}
          {!loading && questions.length === 0 && !addMode && !aiMode && (
            <p className="text-sm text-gray-400">No questions yet for this lesson. Generate with AI or add manually.</p>
          )}
          <div className="space-y-3">
            {questions.map((q, i) => (
              <div key={q.id} className="bg-white border rounded-xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 mb-1">Q{i + 1}</p>
                    <p className="text-sm font-medium">{q.question}</p>
                    <div className="mt-2 space-y-1">
                      {q.options.map((opt, oi) => (
                        <p key={oi} className={`text-xs px-2 py-1 rounded ${oi === q.correct ? "bg-green-100 text-green-700 font-medium" : "text-gray-500"}`}>
                          {oi === q.correct ? "✓ " : ""}{opt}
                        </p>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(q.id)} className="text-xs text-red-400 hover:text-red-600 shrink-0">Remove</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!selectedLessonId && (
        <div className="bg-gray-50 border border-dashed rounded-xl p-8 text-center">
          <p className="text-gray-400 text-sm">Select a lesson above to view or add questions.</p>
        </div>
      )}

      <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 text-sm text-brand-800">
        <p className="font-medium mb-1">How quizzes use this bank</p>
        <p className="text-xs text-brand-700">In each lesson's Quiz editor, enable "Draw from question bank". Each learner gets a random selection — different each attempt.</p>
      </div>
    </div>
  );
}
