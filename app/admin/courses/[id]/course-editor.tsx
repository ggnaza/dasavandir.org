"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Course = {
  id: string;
  title: string;
  description: string | null;
  published: boolean;
};

export function CourseEditor({ course }: { course: Course }) {
  const router = useRouter();
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description ?? "");
  const [published, setPublished] = useState(course.published);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("courses")
      .update({ title, description, published })
      .eq("id", course.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("Delete this course and all its lessons? This cannot be undone.")) return;
    const supabase = createClient();
    await supabase.from("courses").delete().eq("id", course.id);
    router.push("/admin/courses");
  }

  return (
    <form onSubmit={handleSave} className="bg-white border rounded-xl p-6 space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Title</label>
        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="published"
          checked={published}
          onChange={(e) => setPublished(e.target.checked)}
          className="w-4 h-4"
        />
        <label htmlFor="published" className="text-sm font-medium">
          Published (visible to learners)
        </label>
      </div>
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={handleDelete}
          className="text-sm text-red-500 hover:underline"
        >
          Delete course
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
