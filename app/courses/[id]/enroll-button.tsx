"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function EnrollButton({ courseId, isPaid }: { courseId: string; isPaid: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleEnroll() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/enrollments/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      if (res.ok) {
        router.push(`/learn/courses/${courseId}`);
        return;
      }
      // Surface server error instead of silently failing
      let msg = "Failed to enroll. Please try again.";
      try {
        const data = await res.json();
        if (data?.error) msg = data.error;
      } catch {
        const text = await res.text().catch(() => "");
        if (text) msg = text;
      }
      setError(msg);
      setLoading(false);
    } catch (e) {
      setError("Network error — please try again.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleEnroll}
        disabled={loading}
        className="inline-block text-white px-8 py-3 rounded-xl font-semibold text-sm disabled:opacity-60 w-full"
        style={{ backgroundColor: "#EC5328" }}
      >
        {loading ? "Enrolling…" : isPaid ? "Enroll now →" : "Enroll for free →"}
      </button>
      {error && (
        <p className="mt-2 text-sm text-red-600 text-center">{error}</p>
      )}
    </div>
  );
}
