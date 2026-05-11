"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateAnnouncementForm({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setLoading(true);
    setError("");
    setSuccess(false);

    const res = await fetch("/api/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ course_id: courseId, title: title.trim(), body: body.trim() }),
    });

    if (res.ok) {
      setTitle("");
      setBody("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to send announcement");
    }
    setLoading(false);
  }

  return (
    <div className="bg-white border rounded-xl p-5">
      <h3 className="font-semibold text-gray-900 mb-4">New Announcement</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Announcement title"
            required
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your announcement..."
            rows={5}
            required
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 resize-y"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && (
          <p className="text-sm text-green-600">
            ✓ Announcement sent — all enrolled students were notified by email and in-app notification.
          </p>
        )}
        <button
          type="submit"
          disabled={loading || !title.trim() || !body.trim()}
          className="bg-brand-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Sending…" : "Send Announcement"}
        </button>
      </form>
    </div>
  );
}
