"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function DeleteCourseButton({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this course? This cannot be undone.")) return;
    setDeleting(true);
    const supabase = createClient();
    await supabase.from("courses").delete().eq("id", courseId);
    router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="text-sm text-red-400 hover:text-red-600 disabled:opacity-50 ml-3 shrink-0"
    >
      {deleting ? "Deleting…" : "Delete"}
    </button>
  );
}
