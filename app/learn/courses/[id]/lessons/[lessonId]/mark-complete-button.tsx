"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  lessonId: string;
  userId: string;
  isCompleted: boolean;
  courseId: string;
  hasQuiz: boolean;
  quizPassed: boolean;  // true if no quiz OR score >= 80
};

export function MarkCompleteButton({ lessonId, userId, isCompleted, courseId, hasQuiz, quizPassed }: Props) {
  const router = useRouter();
  const [done, setDone] = useState(isCompleted);
  const [loading, setLoading] = useState(false);

  // If quiz exists and not passed, block completion
  const isBlocked = hasQuiz && !quizPassed && !done;

  async function toggle() {
    if (isBlocked) return;
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

  if (isBlocked) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          disabled
          className="text-sm px-4 py-2 rounded-lg font-medium bg-gray-100 text-gray-400 cursor-not-allowed"
        >
          Take quiz to complete
        </button>
        <p className="text-xs text-orange-600">Quiz score of 80% required</p>
      </div>
    );
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
