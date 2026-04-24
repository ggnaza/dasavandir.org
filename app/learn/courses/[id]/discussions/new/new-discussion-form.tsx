"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Lesson {
  id: string;
  title: string;
}

export function NewDiscussionForm({ courseId, lessons }: { courseId: string; lessons: Lesson[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setLoading(true);
    setError("");

    const res = await fetch("/api/discussions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, lessonId: lessonId || null, title, body }),
    });

    if (!res.ok) {
      setError("Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    const data = await res.json();
    router.push(`/learn/courses/${courseId}/discussions/${data.id}`);
  }

  return (
    <form onSubmit={handleSubmit}>
      <Link href={`/learn/courses/${courseId}/discussions`} className="text-sm text-gray-500 hover:text-gray-700">
        ← Discussions
      </Link>
      <h1 className="text-2xl font-bold mt-2 mb-6">New Discussion</h1>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What's your question or topic?"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Related lesson <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <select
            value={lessonId}
            onChange={(e) => setLessonId(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
          >
            <option value="">— General course discussion —</option>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>{l.title}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share your thoughts, question, or insight..."
            rows={6}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
            required
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading || !title.trim() || !body.trim()}
            className="bg-brand-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? "Posting..." : "Post discussion"}
          </button>
          <Link
            href={`/learn/courses/${courseId}/discussions`}
            className="px-5 py-2 rounded-lg text-sm border hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </div>
    </form>
  );
}
