"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  lessonId: string;
  userId: string;
  isCompleted: boolean;
  courseId: string;
};

export function MarkCompleteButton({ lessonId, userId, isCompleted, courseId }: Props) {
  const router = useRouter();
  const [done, setDone] = useState(isCompleted);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const supabase = createClient();
    if (done) {
      await supabase.from("progress").delete().eq("user_id", userId).eq("lesson_id", lessonId);
      setDone(false);
    } else {
      await supabase.from("progress").insert({ user_id: userId, lesson_id: lessonId });
      setDone(true);
    }
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50 ${
        done
          ? "bg-green-100 text-green-700 hover:bg-green-200"
          : "bg-brand-600 text-white hover:bg-brand-700"
      }`}
    >
      {done ? "✓ Completed" : "Mark complete"}
    </button>
  );
}
