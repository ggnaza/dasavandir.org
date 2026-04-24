"use client";
import { useState } from "react";

type Learner = {
  userId: string;
  name: string;
  email: string;
  enrolledAt: string;
  completedCount: number;
  totalLessons: number;
  pct: number;
  completedIds: string[];
};

type Lesson = {
  id: string;
  title: string;
  order: number;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function LearnerRows({ learners, lessons }: { learners: Learner[]; lessons: Lesson[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="divide-y">
      {learners.map((l) => {
        const isOpen = expanded === l.userId;
        const completedSet = new Set(l.completedIds);

        return (
          <div key={l.userId}>
            {/* Summary row */}
            <button
              className="w-full grid grid-cols-12 gap-3 items-center px-5 py-4 hover:bg-gray-50 transition text-left"
              onClick={() => setExpanded(isOpen ? null : l.userId)}
            >
              {/* Name + email */}
              <div className="col-span-4">
                <p className="text-sm font-medium text-gray-900 truncate">{l.name}</p>
                <p className="text-xs text-gray-400 truncate">{l.email}</p>
              </div>

              {/* Progress bar */}
              <div className="col-span-5">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-2 rounded-full ${l.pct === 100 ? "bg-green-500" : "bg-brand-500"}`}
                      style={{ width: `${l.pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 shrink-0 w-14 text-right">
                    {l.completedCount}/{l.totalLessons} {l.pct === 100 ? "✓" : `(${l.pct}%)`}
                  </span>
                </div>
              </div>

              {/* Enrolled date */}
              <span className="col-span-2 text-xs text-gray-400 text-right">
                {l.enrolledAt ? formatDate(l.enrolledAt) : "—"}
              </span>

              {/* Arrow */}
              <span className={`col-span-1 text-gray-400 text-sm text-right transition-transform inline-block ${isOpen ? "rotate-180" : ""}`}>
                ▾
              </span>
            </button>

            {/* Expanded lesson detail */}
            {isOpen && (
              <div className="bg-gray-50 border-t px-5 py-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Lesson progress</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {lessons.map((lesson, i) => {
                    const done = completedSet.has(lesson.id);
                    return (
                      <div key={lesson.id} className="flex items-center gap-2.5">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 font-medium ${done ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-400"}`}>
                          {done ? "✓" : i + 1}
                        </span>
                        <span className={`text-sm truncate ${done ? "text-gray-800" : "text-gray-400"}`}>
                          {lesson.title}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {l.totalLessons === 0 && (
                  <p className="text-xs text-gray-400">No lessons in this course yet.</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
