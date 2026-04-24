"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReplyForm({ discussionId, courseId }: { discussionId: string; courseId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setLoading(true);
    setError("");

    const res = await fetch(`/api/discussions/${discussionId}/replies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });

    if (!res.ok) {
      setError("Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    setBody("");
    setLoading(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border rounded-xl p-4">
      <p className="text-sm font-medium text-gray-700 mb-2">Add a reply</p>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your reply..."
        rows={3}
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      <div className="mt-2 flex justify-end">
        <button
          type="submit"
          disabled={loading || !body.trim()}
          className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Posting..." : "Post reply"}
        </button>
      </div>
    </form>
  );
}
