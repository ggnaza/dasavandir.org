"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

const MAX_CHARS = 3000;

// The exact default instructions the coach uses when no custom ones are set.
// Shown read-only so course creators know what they're overriding.
const DEFAULT_INSTRUCTIONS = `You are a professional development coach. You use Socratic coaching by default, but adapt based on where the teacher-leader is in the conversation.

EXCHANGES 1–3 — SOCRATIC MODE:
When a teacher-leader shares their work, respond with this three-part framework:

1. Analytical Reflection
A brief, neutral summary of the core pedagogical choices you detect in their submission — noting whether the stated intentions match what is actually on the page. No praise, no criticism. Just reflection back to them.

2. Metacognitive Awareness
2–3 probing questions that unpack the how and why behind their choices. Surface assumptions, biases, or unexplored reasoning. Examples: "What made you choose this framework over others?" / "How did your students' prior knowledge shape this design?" / "What bias might be present in this approach?"

3. Actionable Improvement
One single, targeted guiding question — not a suggestion — that challenges them to refine one specific area before finalising their work. Must be a question, not a directive.

EXCEPTION: If the teacher-leader explicitly signals frustration or asks for a direct answer ("just tell me", "I don't know", "what should I do", "I give up"), skip the framework and switch to Direct mode immediately.

EXCHANGE 4+ — DIRECT MODE:
The scaffolding is now optional. Give direct, concrete answers, explanations, and suggestions. You do not need the three-part framework unless it genuinely adds value. Be a knowledgeable colleague, not a gatekeeper.

ALWAYS:
- Never give direct answers in Socratic mode
- Never grade or evaluate quality in Socratic mode ("this is good", "this is weak")
- Redirect off-topic messages back to their coursework
- Ground all responses in what the teacher-leader actually wrote and the course materials`;

export default function AiCoachConfigurationPage() {
  const { id: courseId } = useParams<{ id: string }>();

  const [customInstructions, setCustomInstructions] = useState("");
  const [savedInstructions, setSavedInstructions] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [mode, setMode] = useState<"view-default" | "edit">("view-default");

  useEffect(() => {
    fetch(`/api/admin/courses/${courseId}/ai-coach-settings`)
      .then((r) => r.json())
      .then((d) => {
        const val: string = d.ai_coach_instructions ?? "";
        setSavedInstructions(val);
        if (val) {
          setCustomInstructions(val);
          setMode("edit");
        } else {
          setMode("view-default");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [courseId]);

  async function save() {
    setSaving(true);
    await fetch(`/api/admin/courses/${courseId}/ai-coach-settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ai_coach_instructions: customInstructions }),
    });
    setSavedInstructions(customInstructions);
    setSaving(false);
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 2000);
  }

  async function revertToDefault() {
    if (!confirm("Remove custom instructions and revert to the default Socratic framework?")) return;
    setSaving(true);
    await fetch(`/api/admin/courses/${courseId}/ai-coach-settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ai_coach_instructions: "" }),
    });
    setSavedInstructions("");
    setCustomInstructions("");
    setMode("view-default");
    setSaving(false);
  }

  const isDirty = customInstructions !== (savedInstructions ?? "");
  const charsLeft = MAX_CHARS - customInstructions.length;
  const hasCustom = !!savedInstructions;

  if (loading) {
    return <div className="text-sm text-gray-400 py-8 text-center">Loading…</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Status banner */}
      <div className={`rounded-xl border px-5 py-4 flex items-start gap-3 ${hasCustom ? "bg-green-50 border-green-200" : "bg-blue-50 border-blue-200"}`}>
        <span className="text-xl mt-0.5">{hasCustom ? "✅" : "ℹ️"}</span>
        <div>
          <p className={`font-semibold text-sm ${hasCustom ? "text-green-900" : "text-blue-900"}`}>
            {hasCustom ? "Custom instructions active" : "Using default Socratic framework"}
          </p>
          <p className={`text-xs mt-0.5 ${hasCustom ? "text-green-700" : "text-blue-700"}`}>
            {hasCustom
              ? "Learners in this course see the AI Coach behaviour you defined below."
              : "No custom instructions set. The coach uses the built-in adaptive Socratic framework — visible below."}
          </p>
        </div>
      </div>

      {/* Default instructions — always visible */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm text-gray-900">
              {hasCustom ? "Default instructions (not active)" : "Default instructions (currently active)"}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              This is the built-in behaviour when no custom instructions are set.
            </p>
          </div>
          {!hasCustom && mode === "view-default" && (
            <button
              onClick={() => { setCustomInstructions(DEFAULT_INSTRUCTIONS); setMode("edit"); }}
              className="text-xs border border-brand-300 text-brand-700 px-3 py-1.5 rounded-lg hover:bg-brand-50 font-medium shrink-0"
            >
              Customise from default
            </button>
          )}
        </div>
        <pre className="px-5 py-4 text-xs text-gray-600 whitespace-pre-wrap leading-relaxed font-mono bg-gray-50 max-h-72 overflow-y-auto">
          {DEFAULT_INSTRUCTIONS}
        </pre>
        <div className="px-5 py-3 border-t bg-gray-50 text-xs text-gray-400">
          Anti-hallucination rules, language detection (Armenian ↔ English), and format guidelines are always applied on top of these instructions.
        </div>
      </div>

      {/* Custom instructions editor */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b">
          <p className="font-semibold text-sm text-gray-900">Custom instructions</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Write your own instructions to fully replace the default behaviour above. Leave empty to keep the default.
            You can write in English or Armenian — the coach always replies in whatever language the learner uses.
          </p>
        </div>

        <div className="px-5 py-5 space-y-3">
          {mode === "view-default" ? (
            <div className="border-2 border-dashed border-gray-200 rounded-lg px-4 py-8 text-center text-sm text-gray-400">
              <p>No custom instructions set.</p>
              <button
                onClick={() => { setCustomInstructions(DEFAULT_INSTRUCTIONS); setMode("edit"); }}
                className="mt-3 text-brand-600 hover:underline text-sm font-medium"
              >
                Start from the default →
              </button>
              {" "}
              <button
                onClick={() => { setCustomInstructions(""); setMode("edit"); }}
                className="mt-3 text-gray-500 hover:underline text-sm"
              >
                or start from scratch
              </button>
            </div>
          ) : (
            <>
              <textarea
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value.slice(0, MAX_CHARS))}
                rows={14}
                className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-y font-mono leading-relaxed"
                placeholder="Describe the coach's role, tone, focus areas, and how it should respond to learners…"
              />
              <div className="flex items-center justify-between text-xs">
                <span className={charsLeft < 200 ? "text-amber-600" : "text-gray-400"}>
                  {charsLeft.toLocaleString()} characters remaining
                </span>
                {hasCustom && (
                  <button onClick={revertToDefault} className="text-gray-400 hover:text-red-500">
                    Revert to default
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {mode === "edit" && (
          <div className="px-5 py-4 border-t bg-gray-50 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Changes take effect immediately for all new learner conversations.
            </p>
            <button
              onClick={save}
              disabled={saving || !isDirty || !customInstructions.trim()}
              className="bg-brand-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : savedOk ? "Saved ✓" : "Save instructions"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
