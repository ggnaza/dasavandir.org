"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Message = {
  role: "user" | "assistant";
  content: string;        // sent to the model (may include extracted file text)
  display?: string;       // shown in the bubble (user's typed text only)
  file?: string;          // attached file name, rendered as a chip
};
type Session = {
  id: string;
  lessonTitle: string | null;
  startedAt: string;
  lastMessageAt: string;
  messageCount: number;
  preview: string | null;
};

const SUGGESTIONS = [
  "Here is my lesson plan: [paste it here]",
  "Here is my reflection on this module: [paste it here]",
  "I'd like feedback on my assignment draft: [paste it here]",
  "Here is my teaching artifact: [paste it here]",
];

// Downscale/recompress large raster images in the browser so photos fit the
// upload + vision size limits. Non-image files (PDF/DOCX/TXT) pass through
// untouched. Falls back to the original file if anything goes wrong.
async function downscaleImage(file: File): Promise<File> {
  const isImage = /^image\//.test(file.type) || /\.(png|jpe?g|webp|gif)$/i.test(file.name);
  if (!isImage) return file;
  if (file.size <= 1_500_000) return file; // already small enough
  try {
    const bitmap = await createImageBitmap(file);
    const maxDim = 1600;
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    const newName = file.name.replace(/\.(png|jpe?g|webp|gif)$/i, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function AiCoach({ lessonId, courseId, userId, firstName, lessonTitle }: {
  lessonId: string;
  courseId: string;
  userId: string;
  firstName?: string;
  lessonTitle?: string;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"history" | "chat">("history");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    text?: string;                 // extracted text (text-based files)
    fileBase64?: string;           // raw bytes for vision (scanned/image files)
    mimeType?: string;
  } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const loadHistory = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await fetch(`/api/chat/history?courseId=${courseId}`);
      if (res.ok) setSessions(await res.json());
    } finally {
      setSessionsLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (open) loadHistory();
  }, [open, loadHistory]);

  async function continueSession(session: Session) {
    const res = await fetch(`/api/chat/sessions/${session.id}`);
    if (!res.ok) return;
    const { messages: loaded } = await res.json();
    setMessages(loaded.map((m: any) => ({ role: m.role, content: m.content })));
    setCurrentSessionId(session.id);
    setView("chat");
  }

  function startNewChat() {
    setMessages([]);
    setCurrentSessionId(null);
    setView("chat");
  }

  async function send(text: string) {
    const typed = text.trim();
    const file = attachedFile;
    if ((!typed && !file) || loading) return;

    // What the model sees as text. Extracted text is inlined; a vision file
    // (sent separately as an attachment) just gets a short instruction so the
    // user turn is never empty.
    let modelContent: string;
    if (file?.text) {
      modelContent = `${typed ? typed + "\n\n" : ""}[Attached file: ${file.name}]\n${file.text}`;
    } else if (file?.fileBase64) {
      modelContent = typed || `Please read the attached file "${file.name}" and tell me how it relates to this course.`;
    } else {
      modelContent = typed;
    }
    const userMsg: Message = { role: "user", content: modelContent, display: typed, file: file?.name };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setAttachedFile(null);
    setLoading(true);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: updated.map((m) => ({ role: m.role, content: m.content })),
        attachment: file?.fileBase64 ? { data: file.fileBase64, mimeType: file.mimeType, name: file.name } : undefined,
        lessonId,
        courseId,
        userId,
        sessionId: currentSessionId,
        newSession: currentSessionId === null && messages.length === 0,
      }),
    });

    if (!res.ok || !res.body) {
      setMessages([...updated, { role: "assistant", content: "Something went wrong. Please try again." }]);
      setLoading(false);
      return;
    }

    const returnedSessionId = res.headers.get("X-Session-Id");
    if (returnedSessionId && !currentSessionId) setCurrentSessionId(returnedSessionId);

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

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const original = e.target.files?.[0];
    if (!original) return;
    e.target.value = "";
    setUploading(true);
    try {
      // Shrink large photos so they fit the upload + vision size limits (phone
      // photos are often several MB and would otherwise fail to attach).
      const file = await downscaleImage(original);

      // The serverless upload endpoint can't receive request bodies larger than
      // ~4.5 MB, so guard here with a clear message instead of a silent failure.
      if (file.size > 4_000_000) {
        alert(`"${original.name}" is too large to attach (max ~4 MB). Try a smaller file, or paste the text directly.`);
        return;
      }

      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/chat/upload", { method: "POST", body: fd });
      if (!res.ok) {
        alert((await res.text()) || "Could not attach that file. Please try again.");
        return;
      }
      const data = await res.json();
      if (data.kind === "vision") {
        setAttachedFile({ name: data.name, fileBase64: data.fileBase64, mimeType: data.mimeType });
      } else {
        setAttachedFile({ name: data.name, text: data.text });
      }
    } catch (err) {
      console.error("[ai-coach] file attach failed", err);
      alert("Could not attach that file. Please check your connection and try again, or paste the text directly.");
    } finally {
      setUploading(false);
    }
  }

  async function startRecording() {
    if (!navigator.mediaDevices) { alert("Voice input not supported on this browser."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size < 1000) return;
        setTranscribing(true);
        try {
          const fd = new FormData();
          fd.append("audio", blob, "voice.webm");
          const res = await fetch("/api/chat/transcribe", { method: "POST", body: fd });
          if (res.ok) {
            const { text } = await res.json();
            if (text?.trim()) setInput(text.trim());
          }
        } finally { setTranscribing(false); }
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch { alert("Could not access microphone. Please allow microphone permission."); }
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
          style={{ width: "min(92vw, 400px)", height: "min(80vh, 520px)" }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b flex items-center gap-2 shrink-0">
            {view === "chat" && (
              <button
                onClick={() => { setView("history"); loadHistory(); }}
                className="text-gray-400 hover:text-gray-600 text-lg mr-1 shrink-0"
                title="Back to history"
              >
                ←
              </button>
            )}
            <span className="text-brand-600 font-bold">✦</span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm">AI Coach</p>
              <p className="text-xs text-gray-400 truncate">
                {view === "history"
                  ? "Conversation history"
                  : lessonTitle ? `"${lessonTitle}"` : "Your professional development sounding board"}
              </p>
            </div>
            {view === "chat" && messages.length > 0 && (
              <button
                onClick={startNewChat}
                className="text-xs text-brand-600 hover:text-brand-700 shrink-0 border border-brand-200 rounded-lg px-2 py-1"
              >
                New chat
              </button>
            )}
          </div>

          {/* History view */}
          {view === "history" && (
            <div className="flex-1 overflow-y-auto">
              <div className="p-3">
                <button
                  onClick={startNewChat}
                  className="w-full bg-brand-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-brand-700 transition-colors mb-4"
                >
                  + New Chat
                </button>

                {sessionsLoading ? (
                  <p className="text-sm text-gray-400 text-center py-6">Loading…</p>
                ) : sessions.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-500 mb-1">No conversations yet</p>
                    <p className="text-xs text-gray-400">Start a new chat to get coaching on your work.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Past conversations</p>
                    {sessions.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => continueSession(s)}
                        className="w-full text-left border rounded-xl px-3 py-3 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-brand-600 font-medium truncate max-w-[60%]">
                            {s.lessonTitle ?? "Course chat"}
                          </span>
                          <span className="text-xs text-gray-400 shrink-0">{formatRelativeDate(s.lastMessageAt)}</span>
                        </div>
                        <p className="text-sm text-gray-700 line-clamp-2">
                          {s.preview ?? "(no messages saved)"}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">{s.messageCount} message{s.messageCount !== 1 ? "s" : ""}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Chat view */}
          {view === "chat" && (
            <>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {messages.length === 0 && (
                  <div className="space-y-2">
                    <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-3 py-2 text-sm text-gray-800 mb-3">
                      {firstName
                        ? `Hi ${firstName}! ✦ I'm your AI Coach${lessonTitle ? ` for "${lessonTitle}"` : ""}. Share your work and I'll help you reflect on it — not tell you what to do.`
                        : `Hi! ✦ I'm your AI Coach${lessonTitle ? ` for "${lessonTitle}"` : ""}. Share your work — a lesson plan, reflection, or assignment draft — and I'll help you think through it more deeply.`}
                    </div>
                    <p className="text-xs text-gray-400 mb-1">Share your work to get started:</p>
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
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                        m.role === "user"
                          ? "bg-brand-600 text-white rounded-br-sm whitespace-pre-wrap"
                          : "bg-gray-100 text-gray-800 rounded-bl-sm prose prose-sm prose-gray max-w-none"
                      }`}
                    >
                      {m.role === "user" ? (
                        <>
                          {m.file && (
                            <span className="inline-flex items-center gap-1 bg-white/20 rounded-md px-2 py-0.5 text-xs mb-1">
                              📎 {m.file}
                            </span>
                          )}
                          {(m.display ?? m.content) && <div>{m.display ?? m.content}</div>}
                        </>
                      ) : m.content ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                      ) : (
                        <span className="opacity-50">Thinking…</span>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="px-3 py-3 border-t shrink-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                {attachedFile && (
                  <div className="mb-2 flex items-center gap-2 bg-gray-100 rounded-lg px-2.5 py-1.5 text-xs text-gray-600">
                    <span className="truncate">📎 {attachedFile.name}</span>
                    <button
                      type="button"
                      onClick={() => setAttachedFile(null)}
                      className="ml-auto text-gray-400 hover:text-gray-600 shrink-0 text-sm leading-none"
                      title="Remove file"
                    >
                      ×
                    </button>
                  </div>
                )}
                <form
                  onSubmit={(e) => { e.preventDefault(); send(input); }}
                  className="flex gap-2 items-center"
                >
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading || recording || transcribing || uploading}
                    title="Attach a file (PDF, DOCX, TXT, or image)"
                    className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-base transition ${
                      uploading ? "bg-amber-400 text-white animate-pulse"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    {uploading ? "…" : "📎"}
                  </button>
                  <button
                    type="button"
                    onMouseDown={startRecording}
                    onMouseUp={stopRecording}
                    onTouchStart={startRecording}
                    onTouchEnd={stopRecording}
                    disabled={loading || transcribing || uploading}
                    title="Hold to speak"
                    className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-base transition ${
                      recording ? "bg-red-500 text-white animate-pulse"
                      : transcribing ? "bg-amber-400 text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    {transcribing ? "…" : "🎤"}
                  </button>
                  <textarea
                    rows={1}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      // Enter sends; Shift+Enter inserts a new line. Ignore Enter
                      // while an IME is composing (e.g. Armenian input).
                      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        send(input);
                      }
                    }}
                    placeholder={uploading ? "Extracting file…" : recording ? "Recording…" : transcribing ? "Transcribing…" : attachedFile ? "Add a note about this file (optional)…" : "Share your work or reflection…"}
                    disabled={loading || recording || transcribing || uploading}
                    className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 min-w-0 resize-none max-h-32"
                  />
                  <button
                    type="submit"
                    disabled={loading || (!input.trim() && !attachedFile)}
                    className="bg-brand-600 text-white px-3 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 text-sm font-medium shrink-0"
                  >
                    Send
                  </button>
                </form>
                <p className="text-xs text-gray-400 mt-1 text-center">📎 attach file &nbsp;·&nbsp; Hold 🎤 to speak</p>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
