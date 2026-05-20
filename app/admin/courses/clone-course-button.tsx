"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function CloneCourseButton({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [cloning, setCloning] = useState(false);

  async function handleClone() {
    if (!confirm("Clone this course? A full copy (lessons, quizzes, assignments) will be created as a draft.")) return;
    setCloning(true);
    try {
      const res = await fetch(`/api/admin/courses/${courseId}/clone`, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      const { courseId: newId } = await res.json();
      router.push(`/admin/courses/${newId}`);
      router.refresh();
    } catch {
      alert("Could not clone course. Please try again.");
      setCloning(false);
    }
  }

  return (
    <button
      onClick={handleClone}
      disabled={cloning}
      className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50 ml-3 shrink-0"
    >
      {cloning ? "Cloning…" : "Clone"}
    </button>
  );
}
