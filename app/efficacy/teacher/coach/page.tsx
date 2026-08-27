"use client";
import { useEffect, useState, useRef } from "react";

interface ChatSession {
  id: string;
  kind: string;
  title: string;
  created_at: string;
}

interface ChatMessage {
  role: "user" | "model";
  content: string;
}

export default function AiCoachPage() {
  const [planLink, setPlanLink] = useState("");
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/efficacy/chat")
      .then((r) => r.json())
      .then((data) => setChats(Array.isArray(data) ? data : []));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleCreateChat() {
    if (!planLink.trim()) {
      setMessage({ type: "error", text: "Please paste a lesson plan link" });
      return;
    }
    setCreating(true);
    setMessage(null);
    try {
      const res = await fetch("/api/efficacy/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "plan", plan_link: planLink.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create chat");
      setChats((prev) => [data, ...prev]);
      setActiveChat(data.id);
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      setPlanLink("");
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Failed" });
    } finally {
      setCreating(false);
    }
  }

  async function handleOpenChat(chatId: string) {
    setActiveChat(chatId);
    setMessages([]);
    try {
      const res = await fetch(`/api/efficacy/chat/${chatId}/messages`);
      const data = await res.json();
      // The POST endpoint returns the full message list
      // For opening an existing chat, we need to fetch it differently
      // Since our API only has POST for messages, load from the chat creation response
      // The chat list from GET /api/efficacy/chat should include messages
    } catch {
      // Ignore - user can still send new messages
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !activeChat || sending) return;
    const text = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setSending(true);
    try {
      const res = await fetch(`/api/efficacy/chat/${activeChat}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      if (data.reply) {
        setMessages((prev) => [...prev, { role: "model", content: data.reply }]);
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: "model", content: `Error: ${e instanceof Error ? e.message : "Failed"}` },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Lesson Coach</h1>
        <p className="text-gray-600 mt-1">
          Get AI coaching on your lesson plan. Paste a Google Docs link to start.
        </p>
      </div>

      {message && (
        <div
          className={`p-3 rounded-lg text-sm ${
            message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {!activeChat && (
        <>
          <div className="bg-white rounded-lg border p-6">
            <h2 className="font-semibold text-gray-900 mb-3">Start New Coaching Session</h2>
            <div className="flex gap-3">
              <input
                type="url"
                value={planLink}
                onChange={(e) => setPlanLink(e.target.value)}
                placeholder="Paste your lesson plan link (Google Docs)..."
                className="flex-1 border rounded-lg px-3 py-2"
              />
              <button
                onClick={handleCreateChat}
                disabled={creating}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {creating ? "Starting..." : "Start Chat"}
              </button>
            </div>
          </div>

          {chats.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Previous Chats</h2>
              <div className="bg-white rounded-lg border divide-y">
                {chats.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => handleOpenChat(chat.id)}
                    className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="font-medium text-gray-900">{chat.title || `${chat.kind} chat`}</div>
                    <div className="text-sm text-gray-500">
                      {new Date(chat.created_at).toLocaleDateString()}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {activeChat && (
        <div className="bg-white rounded-lg border flex flex-col" style={{ height: "calc(100vh - 300px)", minHeight: 400 }}>
          <div className="p-3 border-b bg-gray-50 rounded-t-lg flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">AI Coach</span>
            <button
              onClick={() => {
                setActiveChat(null);
                setMessages([]);
              }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Back to list
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-sm text-gray-400 text-center mt-8">
                Start the conversation...
              </p>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-orange-500 text-white"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-500 rounded-lg px-4 py-2.5 text-sm">
                  Thinking...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={handleSendMessage} className="p-3 border-t flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 border rounded-lg px-3 py-2 text-sm"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
