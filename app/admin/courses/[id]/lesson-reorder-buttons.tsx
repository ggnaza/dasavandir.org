"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  lessonId: string;
  courseId: string;
  isFirst: boolean;
  isLast: boolean;
};

export function LessonReorderButtons({ lessonId, courseId, isFirst, isLast }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function move(direction: "up" | "down") {
    setLoading(true);
    await fetch("/api/lessons/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId, courseId, direction }),
    });
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="flex flex-col gap-0.5">
      <button
        onClick={() => move("up")}
        disabled={isFirst || loading}
        className="text-gray-400 hover:text-gray-700 disabled:opacity-20 leading-none text-xs"
        title="Move up"
      >
        ▲
      </button>
      <button
        onClick={() => move("down")}
        disabled={isLast || loading}
        className="text-gray-400 hover:text-gray-700 disabled:opacity-20 leading-none text-xs"
        title="Move down"
      >
        ▼
      </button>
    </div>
  );
}
