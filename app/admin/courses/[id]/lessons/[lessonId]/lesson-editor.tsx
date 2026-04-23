"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LessonContentEditor } from "@/components/lesson-content-editor-dynamic";

type Lesson = {
  id: string;
  title: string;
  content: string | null;
  video_url: string | null;
  order: number;
};

export function LessonEditor({ lesson, courseId }: { lesson: Lesson; courseId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState(lesson.title);
  const [content, setContent] = useState(lesson.content ?? "");
  const [videoUrl, setVideoUrl] = useState(lesson.video_url ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("lessons")
      .update({ title, content, video_url: videoUrl || null })
      .eq("id", lesson.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("Delete this lesson? This cannot be undone.")) return;
    const supabase = createClient();
    await supabase.from("lessons").delete().eq("id", lesson.id);
    router.push(`/admin/courses/${courseId}`);
  }

  return (
    <form onSubmit={handleSave} className="bg-white border rounded-xl p-6 space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Lesson title</label>
        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
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
        {videoUrl && <p className="text-xs text-gray-500 mt-1">Video will be embedded for learners.</p>}
      </div>

      <div className="flex items-center justify-between pt-2">
        <button type="button" onClick={handleDelete} className="text-sm text-red-500 hover:underline">
          Delete lesson
        </button>
        <button
          type="submit"
          disabled={saving}
          className="bg-brand-600 text-white px-5 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 text-sm font-medium"
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
