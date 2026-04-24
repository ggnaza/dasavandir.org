"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function EnrollButton({ courseId, isPaid }: { courseId: string; isPaid: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleEnroll() {
    setLoading(true);
    const res = await fetch("/api/enrollments/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId }),
    });
    if (res.ok) {
      router.push(`/learn/courses/${courseId}`);
    } else {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleEnroll}
      disabled={loading}
      className="inline-block text-white px-8 py-3 rounded-xl font-semibold text-sm disabled:opacity-60"
      style={{ backgroundColor: "#EC5328" }}
    >
      {loading ? "Enrolling…" : isPaid ? "Enroll now →" : "Enroll for free →"}
    </button>
  );
}
