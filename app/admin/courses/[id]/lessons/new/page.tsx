"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { LessonContentEditor } from "@/components/lesson-content-editor-dynamic";

export default function NewLessonPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();

    const { data: existing } = await supabase
      .from("lessons")
      .select("order")
      .eq("course_id", params.id)
      .order("order", { ascending: false })
      .limit(1)
      .single();

    const nextOrder = (existing?.order ?? 0) + 1;

    const { data, error } = await supabase
      .from("lessons")
      .insert({ course_id: params.id, title, content, video_url: videoUrl || null, order: nextOrder })
      .select("id")
      .single();

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push(`/admin/courses/${params.id}/lessons/${data.id}`);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href={`/admin/courses/${params.id}`} className="text-sm text-gray-500 hover:text-gray-700">← Back to course</Link>
        <h1 className="text-2xl font-bold mt-2">New Lesson</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Lesson title</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. What is Marketing?"
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <LessonContentEditor value={content} onChange={setContent} />

        <div>
          <label className="block text-sm font-medium mb-1">Video URL <span className="text-gray-400">(optional)</span></label>
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-600 text-white py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 font-medium"
        >
          {loading ? "Creating…" : "Create lesson"}
        </button>
      </form>
    </div>
  );
}
