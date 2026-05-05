"use client";
import { useState, useRef, useEffect } from "react";

type Message = { role: "user" | "assistant"; content: string };
type Provider = "openai" | "gemini";

const SUGGESTIONS = [
  "Summarize this lesson",
  "Quiz me on this topic",
  "Explain this in simpler terms",
  "What are the key takeaways?",
];

const PROVIDERS: { id: Provider; label: string; short: string }[] = [
  { id: "openai", label: "GPT-4o mini", short: "GPT" },
  { id: "gemini", label: "Gemini 2.0 Flash", short: "Gemini" },
];

export function AiCoach({ lessonId, courseId, userId }: { lessonId: string; courseId: string; userId: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [provider, setProvider] = useState<Provider>("openai");
  const bottomRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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
      body: JSON.stringify({ messages: updated, lessonId, courseId, userId, provider }),
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

  async function startRecording() {
    if (!navigator.mediaDevices) {
      alert("Voice input not supported on this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size < 1000) return; // too short
        setTranscribing(true);
        try {
          const fd = new FormData();
          fd.append("audio", blob, "voice.webm");
          const res = await fetch("/api/chat/transcribe", { method: "POST", body: fd });
          if (res.ok) {
            const { text } = await res.json();
            if (text?.trim()) {
              setInput(text.trim());
            }
          }
        } finally {
          setTranscribing(false);
        }
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch {
      alert("Could not access microphone. Please allow microphone permission.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-4 sm:right-6 bg-brand-600 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:bg-brand-700 z-50 text-2xl"
        title="AI Coach"
      >
        {open ? "×" : "✦"}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-24 right-2 sm:right-6 bg-white border rounded-2xl shadow-xl flex flex-col z-50"
          style={{ width: "min(92vw, 400px)", height: "min(80vh, 500px)" }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b flex items-center gap-2 shrink-0">
            <span className="text-brand-600 font-bold">✦</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">AI Coach</p>
              <p className="text-xs text-gray-400">Remembers your progress across sessions</p>
            </div>
            <div className="flex gap-1 shrink-0">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setProvider(p.id)}
                  title={p.label}
                  className={`text-xs px-2 py-1 rounded-md font-medium transition ${
                    provider === p.id
                      ? "bg-brand-600 text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {p.short}
                </button>
              ))}
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
          <div className="px-3 py-3 border-t shrink-0">
            <form
              onSubmit={(e) => { e.preventDefault(); send(input); }}
              className="flex gap-2 items-center"
            >
              {/* Mic button */}
              <button
                type="button"
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                disabled={loading || transcribing}
                title="Hold to speak"
                className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-base transition ${
                  recording
                    ? "bg-red-500 text-white animate-pulse"
                    : transcribing
                    ? "bg-amber-400 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {transcribing ? "…" : "🎤"}
              </button>

              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={recording ? "Recording…" : transcribing ? "Transcribing…" : "Ask a question…"}
                disabled={loading || recording || transcribing}
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 min-w-0"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="bg-brand-600 text-white px-3 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 text-sm font-medium shrink-0"
              >
                Send
              </button>
            </form>
            <p className="text-xs text-gray-400 mt-1 text-center">Hold 🎤 to speak in any language</p>
          </div>
        </div>
      )}
    </>
  );
}
