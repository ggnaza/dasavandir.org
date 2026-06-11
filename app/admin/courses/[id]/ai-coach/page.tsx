"use client";
import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Message = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Help me draft feedback for a submission that needs revision",
  "A teacher-leader hasn't made progress in two weeks — how should I approach them?",
  "I need to calibrate my grading — here's a borderline submission: [paste it]",
  "What facilitation strategies help with cohort-wide knowledge gaps?",
  "Help me prepare talking points for a group check-in",
];

const MAX_CHARS = 3000;

const DEFAULT_INSTRUCTIONS_HINT = `Describe the coach's role, tone, and focus for learners in this course.

Example:
"The AI Coach supports teacher-leaders in reflecting on their practice. When a TL shares work, the coach identifies the core pedagogical choices made, asks questions that surface the reasoning behind those choices, and ends with one guiding question to push the work further. The coach never gives direct answers in the first few exchanges — it acts as a thinking partner, not an answer key."

You can write in English or Armenian. The coach will always reply in whatever language the learner uses.`;

export default function CreatorAiCoachPage() {
  const { id: courseId } = useParams<{ id: string }>();

  // --- Settings state ---
  const [instructions, setInstructions] = useState("");
  const [savedInstructions, setSavedInstructions] = useState("");
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // --- Chat state ---
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch(`/api/admin/courses/${courseId}/ai-coach-settings`)
      .then((r) => r.json())
      .then((d) => {
        const val = d.ai_coach_instructions ?? "";
        setInstructions(val);
        setSavedInstructions(val);
        // Open settings panel if nothing is configured yet
        setSettingsOpen(!val);
      })
      .catch(() => {})
      .finally(() => setLoadingSettings(false));
  }, [courseId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  async function saveSettings() {
    setSavingSettings(true);
    await fetch(`/api/admin/courses/${courseId}/ai-coach-settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ai_coach_instructions: instructions }),
    });
    setSavedInstructions(instructions);
    setSavingSettings(false);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  }

  async function send(text: string) {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", content: text.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);

    const res = await fetch("/api/admin/courses/ai-coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, messages: updated }),
    });

    if (!res.ok || !res.body) {
      setMessages([...updated, { role: "assistant", content: "Something went wrong. Please try again." }]);
      setLoading(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let reply = "";
    setMessages([...updated, { role: "assistant", content: "" }]);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      reply += decoder.decode(value);
      setMessages([...updated, { role: "assistant", content: reply }]);
    }

    setLoading(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  const isDirty = instructions !== savedInstructions;
  const charsLeft = MAX_CHARS - instructions.length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* ── Learner Coach Configuration ── */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <button
          onClick={() => setSettingsOpen((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-lg">⚙️</span>
            <div>
              <p className="font-semibold text-sm text-gray-900">Learner Coach Configuration</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {loadingSettings
                  ? "Loading…"
                  : savedInstructions
                  ? "Custom instructions active"
                  : "Using default Socratic coaching — click to customise"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {savedInstructions && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Active</span>
            )}
            <span className="text-gray-400 text-sm">{settingsOpen ? "▲" : "▼"}</span>
          </div>
        </button>

        {settingsOpen && (
          <div className="border-t px-5 py-5 space-y-4">
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-gray-700 space-y-1">
              <p className="font-medium text-blue-900">How this works</p>
              <p>
                Write instructions that define how the AI Coach behaves for learners in this course — its persona,
                focus, tone, and boundaries. If left empty, the coach uses the default Socratic framework
                (reflective questions for the first 3 exchanges, then direct answers).
              </p>
              <p className="text-xs text-blue-700 mt-1">
                You can write in English or Armenian. The coach always replies in whatever language the learner uses.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Coach instructions
              </label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value.slice(0, MAX_CHARS))}
                placeholder={DEFAULT_INSTRUCTIONS_HINT}
                rows={10}
                className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-y font-mono leading-relaxed"
              />
              <div className="flex items-center justify-between mt-1">
                <p className={`text-xs ${charsLeft < 200 ? "text-amber-600" : "text-gray-400"}`}>
                  {charsLeft.toLocaleString()} characters remaining
                </p>
                {instructions && (
                  <button
                    onClick={() => setInstructions("")}
                    className="text-xs text-gray-400 hover:text-red-500"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-gray-400">
                Changes take effect immediately for all new learner conversations.
              </p>
              <button
                onClick={saveSettings}
                disabled={savingSettings || !isDirty}
                className="bg-brand-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
              >
                {savingSettings ? "Saving…" : settingsSaved ? "Saved ✓" : "Save instructions"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Facilitation Chat ── */}
      <div className="flex flex-col" style={{ height: "calc(100vh - 340px)", minHeight: "400px" }}>
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span className="text-brand-600">✦</span> AI Facilitation Coach
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Your private assistant for grading, feedback drafting, and cohort facilitation. Not visible to learners.
            </p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => { if (confirm("Clear this conversation?")) setMessages([]); }}
              className="text-xs text-gray-400 hover:text-gray-600 border rounded px-2 py-1"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {messages.length === 0 ? (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-gray-700">
                <p className="font-medium mb-1">How this works</p>
                <p>
                  This coach helps you with the facilitation side of your work — drafting feedback, thinking through
                  grading, preparing for check-ins. It sees your cohort&apos;s overall progress but not individual
                  chat transcripts. Conversations here are private and not stored.
                </p>
              </div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Try one of these:</p>
              <div className="space-y-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="block w-full text-left text-sm border rounded-lg px-4 py-3 hover:bg-gray-50 text-gray-600 hover:border-brand-300 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <span className="text-brand-600 font-bold mr-2 mt-1 shrink-0 text-sm">✦</span>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                    m.role === "user"
                      ? "bg-brand-600 text-white rounded-br-sm whitespace-pre-wrap"
                      : "bg-gray-50 border text-gray-800 rounded-bl-sm prose prose-sm prose-gray max-w-none"
                  }`}
                >
                  {m.role === "user" ? (
                    m.content || <span className="opacity-50">…</span>
                  ) : m.content ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                  ) : (
                    <span className="opacity-50">Thinking…</span>
                  )}
                </div>
              </div>
            ))
          )}
          {loading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex justify-start">
              <span className="text-brand-600 font-bold mr-2 mt-1 text-sm">✦</span>
              <div className="bg-gray-50 border rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-gray-400">
                Thinking…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t pt-4 mt-4 shrink-0">
          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="flex gap-2 items-end"
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question or paste a submission for review… (Enter to send, Shift+Enter for new line)"
              disabled={loading}
              rows={1}
              className="flex-1 border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 resize-none overflow-hidden"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-brand-600 text-white px-4 py-3 rounded-xl hover:bg-brand-700 disabled:opacity-50 text-sm font-medium shrink-0"
            >
              Send
            </button>
          </form>
          <p className="text-xs text-gray-400 mt-2">Conversations are not saved between sessions.</p>
        </div>
      </div>
    </div>
  );
}
