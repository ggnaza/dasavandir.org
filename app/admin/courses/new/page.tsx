"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function NewCoursePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("courses")
      .insert({ title, description, created_by: user!.id })
      .select("id")
      .single();

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push(`/admin/courses/${data.id}`);
    }
  }

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <Link href="/admin/courses" className="text-sm text-gray-500 hover:text-gray-700">← Back to courses</Link>
        <h1 className="text-2xl font-bold mt-2">New Course</h1>
      </div>

      {/* AI generation option */}
      <Link
        href="/admin/courses/generate"
        className="flex items-start gap-4 bg-brand-50 border border-brand-200 rounded-xl p-4 mb-4 hover:bg-brand-100 transition-colors group"
      >
        <span className="text-2xl mt-0.5">✦</span>
        <div>
          <p className="text-sm font-semibold text-brand-900">Generate course with AI</p>
          <p className="text-xs text-brand-700 mt-0.5">
            Upload a Google Doc, Google Slides, or PDF — AI builds the full course structure, lesson content, slide outlines, and video scripts automatically.
          </p>
        </div>
        <span className="text-brand-400 text-lg ml-auto group-hover:translate-x-0.5 transition-transform">→</span>
      </Link>

      <p className="text-xs text-gray-400 text-center mb-4">— or create manually —</p>

      <form onSubmit={handleSubmit} className="bg-white border rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Introduction to Marketing"
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description <span className="text-gray-400">(optional)</span></label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What will learners gain from this course?"
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-600 text-white py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 font-medium"
        >
          {loading ? "Creating…" : "Create course"}
        </button>
      </form>
    </div>
  );
}
