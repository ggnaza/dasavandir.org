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

export default function CreatorAiCoachPage() {
  const { id: courseId } = useParams<{ id: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

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

  function clearHistory() {
    if (messages.length === 0) return;
    if (confirm("Clear this conversation?")) setMessages([]);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] max-w-3xl mx-auto">
      {/* Header */}
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
            onClick={clearHistory}
            className="text-xs text-gray-400 hover:text-gray-600 border rounded px-2 py-1"
          >
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
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

      {/* Input */}
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
  );
}
