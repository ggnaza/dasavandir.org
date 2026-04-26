"use client";
import { useState } from "react";

type Result = { title: string; status: string; duration_seconds: number | null };

export function BackfillDurationsButton({ courseId }: { courseId: string }) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);

  async function run() {
    setLoading(true);
    setResults(null);
    const res = await fetch("/api/admin/backfill-durations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId }),
    });
    const data = await res.json();
    setResults(data.results ?? []);
    setLoading(false);
  }

  return (
    <div className="mt-4 space-y-3">
      <button
        onClick={run}
        disabled={loading}
        className="text-sm border border-gray-300 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50 font-medium disabled:opacity-50"
      >
        {loading ? "Fetching durations…" : "Fetch video durations from Drive"}
      </button>

      {results && (
        <div className="border rounded-lg overflow-hidden text-sm">
          {results.map((r, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-b last:border-0 bg-white">
              <span className={`shrink-0 font-medium ${r.status === "ok" ? "text-green-600" : "text-red-500"}`}>
                {r.status === "ok" ? "✓" : "✗"}
              </span>
              <span className="flex-1 text-gray-700 truncate">{r.title}</span>
              <span className="text-gray-400 shrink-0">
                {r.status === "ok" && r.duration_seconds
                  ? `${Math.floor(r.duration_seconds / 60)} min`
                  : r.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
