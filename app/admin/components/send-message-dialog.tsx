"use client";
import { useState, useEffect, useRef } from "react";

interface Props {
  userId: string;
  learnerName: string;
  /** Optional pre-filled subject — useful for context-specific messages */
  defaultSubject?: string;
  /** Render trigger as a small icon button (default) or a full-size button */
  variant?: "icon" | "button";
}

export function SendMessageDialog({
  userId,
  learnerName,
  defaultSubject = "",
  variant = "icon",
}: Props) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setSubject(defaultSubject);
      setMessage("");
      setSent(false);
      setError("");
    }
  }, [open, defaultSubject]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function handleSend() {
    if (!subject.trim() || !message.trim()) {
      setError("Both subject and message are required.");
      return;
    }
    setSending(true);
    setError("");

    const res = await fetch("/api/admin/learner/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, subject: subject.trim(), message: message.trim() }),
    });

    if (!res.ok) {
      setError(await res.text());
      setSending(false);
      return;
    }

    setSent(true);
    setSending(false);
    // Auto-close after 1.5s on success
    setTimeout(() => setOpen(false), 1500);
  }

  const trigger =
    variant === "button" ? (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all font-medium"
      >
        <span>💬</span> Message
      </button>
    ) : (
      <button
        onClick={() => setOpen(true)}
        title={`Message ${learnerName}`}
        className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-all"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path d="M3.505 2.365A41.369 41.369 0 0 1 9 2c1.863 0 3.697.124 5.495.365 1.247.167 2.18 1.108 2.435 2.268a4.45 4.45 0 0 0-.577-.069 43.141 43.141 0 0 0-4.706 0C9.229 4.696 7.5 6.727 7.5 8.998v2.24c0 1.413.67 2.735 1.76 3.562l-2.98 2.98C6.08 17.98 6 18.218 6 18.5c0 .828.672 1.5 1.5 1.5h.5V19.5h-.5A2.5 2.5 0 0 1 5 17a2.49 2.49 0 0 1 .732-1.768L7.322 13.6A5.494 5.494 0 0 1 6 9.998V8.997C6 6.097 8.178 3.698 11.05 3.5a45.138 45.138 0 0 1 1.45-.028c.532 0 1.058.012 1.579.035C14.33 2.68 13.274 2 12.075 2 9.78 2 7.527 2.107 5.318 2.316 3.879 2.457 3 3.54 3 4.822V16.5A1.5 1.5 0 0 0 4.5 18H5v1.5H4.5A3 3 0 0 1 1.5 16.5V4.822C1.5 2.87 2.808 1.13 4.668.972 6.94.8 9.243.75 11.55.82" />
        </svg>
      </button>
    );

  return (
    <>
      {trigger}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
          style={{ background: "rgba(0,0,0,0.4)" }}
        >
          <div
            ref={dialogRef}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
            role="dialog"
            aria-modal="true"
            aria-labelledby="msg-dialog-title"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 id="msg-dialog-title" className="text-base font-semibold text-gray-900">
                  Message {learnerName}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Sends in-app notification + email</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {sent ? (
              <div className="px-6 py-10 text-center">
                <p className="text-3xl mb-3">✓</p>
                <p className="text-base font-semibold text-green-700">Message sent!</p>
                <p className="text-sm text-gray-500 mt-1">{learnerName} will receive it in-app and by email.</p>
              </div>
            ) : (
              <div className="px-6 py-5 space-y-4">
                {/* Subject */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Subject <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => { setSubject(e.target.value); setError(""); }}
                    placeholder="e.g. Module 3 check-in"
                    maxLength={200}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                {/* Message body */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Message <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => { setMessage(e.target.value); setError(""); }}
                    placeholder={`Write your message to ${learnerName}…`}
                    rows={5}
                    maxLength={3000}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                  />
                  <p className="text-xs text-gray-400 mt-0.5 text-right">{message.length}/3000</p>
                </div>

                {error && <p className="text-xs text-red-600">{error}</p>}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={sending || !subject.trim() || !message.trim()}
                    className="flex-1 bg-brand-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
                  >
                    {sending ? "Sending…" : "Send message"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
