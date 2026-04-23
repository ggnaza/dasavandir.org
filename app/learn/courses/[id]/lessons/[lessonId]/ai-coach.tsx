"use client";
import { useState, useRef, useEffect } from "react";

type Message = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Summarize this lesson",
  "Quiz me on this topic",
  "Explain this in simpler terms",
  "What are the key takeaways?",
];

export function AiCoach({ lessonId }: { lessonId: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", content: text.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: updated, lessonId }),
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

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 bg-brand-600 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:bg-brand-700 z-50 text-2xl"
        title="AI Coach"
      >
        {open ? "×" : "✦"}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 w-80 sm:w-96 bg-white border rounded-2xl shadow-xl flex flex-col z-50" style={{ height: "480px" }}>
          {/* Header */}
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <span className="text-brand-600 font-bold">✦</span>
            <div>
              <p className="font-semibold text-sm">AI Coach</p>
              <p className="text-xs text-gray-400">Ask anything about this lesson</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-400 mb-3">Try asking:</p>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="block w-full text-left text-sm border rounded-lg px-3 py-2 hover:bg-gray-50 text-gray-600"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-brand-600 text-white rounded-br-sm"
                      : "bg-gray-100 text-gray-800 rounded-bl-sm"
                  }`}
                >
                  {m.content || <span className="opacity-50">Thinking…</span>}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t">
            <form
              onSubmit={(e) => { e.preventDefault(); send(input); }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question…"
                disabled={loading}
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="bg-brand-600 text-white px-3 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 text-sm font-medium"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
