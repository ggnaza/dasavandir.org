"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type Question = { id: string; question: string; options: string[]; correct: number; topic: string | null };

export default function QuestionBankPage({ params }: { params: { id: string } }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newQ, setNewQ] = useState({ question: "", options: ["", "", "", ""], correct: 0, topic: "" });
  const [addMode, setAddMode] = useState(false);
  const [error, setError] = useState("");
  const [filterTopic, setFilterTopic] = useState("");

  const supabase = createClient();

  async function load() {
    const { data } = await supabase
      .from("question_bank")
      .select("id, question, options, correct, topic")
      .eq("course_id", params.id)
      .order("created_at", { ascending: false });
    setQuestions((data ?? []) as Question[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newQ.question.trim() || newQ.options.some((o) => !o.trim())) {
      setError("Fill all fields and options.");
      return;
    }
    setSaving(true);
    setError("");
    const { error: err } = await supabase.from("question_bank").insert({
      course_id: params.id,
      question: newQ.question.trim(),
      options: newQ.options,
      correct: newQ.correct,
      topic: newQ.topic.trim() || null,
    });
    if (err) { setError(err.message); setSaving(false); return; }
    setNewQ({ question: "", options: ["", "", "", ""], correct: 0, topic: "" });
    setAddMode(false);
    setSaving(false);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this question?")) return;
    await supabase.from("question_bank").delete().eq("id", id);
    load();
  }

  const topics = Array.from(new Set(questions.map((q) => q.topic).filter(Boolean)));
  const filtered = filterTopic ? questions.filter((q) => q.topic === filterTopic) : questions;

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Question Bank</h2>
          <p className="text-sm text-gray-500">{questions.length} questions · used for randomized quizzes</p>
        </div>
        <button
          onClick={() => setAddMode((v) => !v)}
          className="bg-brand-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-brand-700"
        >
          {addMode ? "Cancel" : "+ Add question"}
        </button>
      </div>

      {/* Add form */}
      {addMode && (
        <form onSubmit={handleAdd} className="bg-white border rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1 text-gray-600">Topic (optional)</label>
            <input
              type="text"
              value={newQ.topic}
              onChange={(e) => setNewQ({ ...newQ, topic: e.target.value })}
              placeholder="e.g. Leadership, Module 1"
              className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 text-gray-600">Question</label>
            <input
              type="text"
              value={newQ.question}
              onChange={(e) => setNewQ({ ...newQ, question: e.target.value })}
              placeholder="Enter question"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-600">Options — select correct answer</label>
            {newQ.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correct"
                  checked={newQ.correct === i}
                  onChange={() => setNewQ({ ...newQ, correct: i })}
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
          <button
            type="submit"
            disabled={saving}
            className="bg-brand-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Add to bank"}
          </button>
        </form>
      )}

      {/* Topic filter */}
      {topics.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterTopic("")}
            className={`text-xs px-3 py-1 rounded-full border ${!filterTopic ? "bg-brand-600 text-white border-brand-600" : "text-gray-600 border-gray-300"}`}
          >
            All
          </button>
          {topics.map((t) => (
            <button
              key={t!}
              onClick={() => setFilterTopic(t!)}
              className={`text-xs px-3 py-1 rounded-full border ${filterTopic === t ? "bg-brand-600 text-white border-brand-600" : "text-gray-600 border-gray-300"}`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Question list */}
      {loading && <p className="text-sm text-gray-400">Loading…</p>}
      {!loading && filtered.length === 0 && (
        <p className="text-sm text-gray-400">No questions yet. Add some above.</p>
      )}
      <div className="space-y-3">
        {filtered.map((q, i) => (
          <div key={q.id} className="bg-white border rounded-xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                {q.topic && (
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full mb-2 inline-block">{q.topic}</span>
                )}
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

      <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 text-sm text-brand-800">
        <p className="font-medium mb-1">How to use question banks in quizzes</p>
        <p className="text-xs text-brand-700">Go to any lesson → Quiz tab → enable "Draw from question bank". Each learner gets a random set of questions from this pool. Works on retakes too.</p>
      </div>
    </div>
  );
}
