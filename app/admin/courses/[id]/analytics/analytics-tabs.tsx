"use client";
import { useState } from "react";

export function AnalyticsTabs({
  overviewContent,
  quizContent,
}: {
  overviewContent: React.ReactNode;
  quizContent: React.ReactNode;
}) {
  const [tab, setTab] = useState<"overview" | "quiz">("overview");

  return (
    <div>
      {/* Tab pills */}
      <div className="flex gap-1 mb-6 border-b">
        {(["overview", "quiz"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {t === "overview" ? "Overview" : "Quiz Analysis"}
          </button>
        ))}
      </div>

      {tab === "overview" ? overviewContent : quizContent}
    </div>
  );
}
