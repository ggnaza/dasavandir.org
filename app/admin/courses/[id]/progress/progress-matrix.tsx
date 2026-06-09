"use client";
import { useState, useMemo } from "react";
import Link from "next/link";

export type LessonMeta = {
  id: string;
  title: string;
  order: number;
  hasVideo: boolean; // has video_url
};

export type LearnerRow = {
  userId: string;
  name: string;
  email: string;
  // per-lesson: lessonId → { completed: boolean; seconds: number }
  lessons: Record<string, { completed: boolean; seconds: number }>;
  totalSeconds: number;
  videoSeconds: number;
  readingSeconds: number;
  completedCount: number;
};

type Props = {
  courseId: string;
  lessonMeta: LessonMeta[];
  learners: LearnerRow[];
  isCohortLimited: boolean;
  cohortSize: number;
};

function fmt(seconds: number): string {
  if (seconds === 0) return "—";
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

function Cell({ completed, seconds, hasVideo }: { completed: boolean; seconds: number; hasVideo: boolean }) {
  const icon = hasVideo ? "▶" : "📖";
  const timeStr = seconds > 0 ? fmt(seconds) : null;

  if (!completed && seconds === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-12 w-20 text-gray-200">
        <span className="text-xs">—</span>
      </div>
    );
  }

  if (!completed && seconds > 0) {
    // Started but not marked complete
    return (
      <div className="flex flex-col items-center justify-center h-12 w-20">
        <span className="text-xs text-amber-500 font-medium">{icon} {timeStr}</span>
        <span className="text-xs text-amber-400 mt-0.5">in progress</span>
      </div>
    );
  }

  // Completed
  return (
    <div className="flex flex-col items-center justify-center h-12 w-20">
      <span className="text-green-600 text-sm font-bold">✓</span>
      {timeStr && <span className="text-xs text-gray-400 mt-0.5">{icon} {timeStr}</span>}
    </div>
  );
}

export function ProgressMatrix({ courseId, lessonMeta, learners, isCohortLimited, cohortSize }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    let rows = [...learners];
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q));
    }
    if (statusFilter === "not_started") rows = rows.filter((r) => r.completedCount === 0);
    else if (statusFilter === "in_progress") rows = rows.filter((r) => r.completedCount > 0 && r.completedCount < lessonMeta.length);
    else if (statusFilter === "completed") rows = rows.filter((r) => r.completedCount === lessonMeta.length);
    return rows;
  }, [learners, search, statusFilter, lessonMeta.length]);

  const totalLessons = lessonMeta.length;
  const videoLessons = lessonMeta.filter((l) => l.hasVideo).length;
  const readingLessons = totalLessons - videoLessons;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold mb-1">Progress Matrix</h2>
        <p className="text-sm text-gray-500">
          Exact module-by-module progress and time spent per learner.
          {isCohortLimited && (
            <span className="ml-2 text-blue-600 font-medium">Your cohort ({cohortSize} learners).</span>
          )}
          <span className="ml-2 text-gray-400">
            {videoLessons} video lesson{videoLessons !== 1 ? "s" : ""} (▶) · {readingLessons} reading{readingLessons !== 1 ? "s" : ""} (📖)
          </span>
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search learner…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="all">All statuses</option>
          <option value="not_started">Not started</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
        </select>
        <span className="text-xs text-gray-400 ml-auto">
          {filtered.length} of {learners.length} learners
        </span>
      </div>

      {learners.length === 0 ? (
        <div className="bg-white border rounded-xl p-12 text-center text-gray-400">
          No learners enrolled yet.
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border rounded-xl p-8 text-center text-gray-400 text-sm">
          No learners match your filters.
        </div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          {/* Horizontally scrollable table */}
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  {/* Sticky learner column */}
                  <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap border-r min-w-[180px]">
                    Learner
                  </th>
                  {/* Lesson columns */}
                  {lessonMeta.map((l) => (
                    <th
                      key={l.id}
                      className="px-2 py-3 text-center text-xs font-medium text-gray-500 whitespace-nowrap w-20"
                      title={l.title}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-gray-400">{l.hasVideo ? "▶" : "📖"}</span>
                        <span className="font-semibold text-gray-600">M{l.order}</span>
                        <span className="text-gray-400 max-w-[72px] truncate text-xs normal-case font-normal" title={l.title}>
                          {l.title}
                        </span>
                      </div>
                    </th>
                  ))}
                  {/* Summary columns */}
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap border-l w-24">
                    Completed
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap w-24">
                    Total time
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap w-24">
                    ▶ Video
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap w-24">
                    📖 Reading
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap w-20">
                    Detail
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((learner) => {
                  const pct =
                    totalLessons > 0
                      ? Math.round((learner.completedCount / totalLessons) * 100)
                      : 0;
                  return (
                    <tr key={learner.userId} className="hover:bg-gray-50 transition-colors">
                      {/* Sticky learner info */}
                      <td className="sticky left-0 z-10 bg-white px-4 py-2 border-r min-w-[180px]">
                        <p className="font-medium text-gray-900 truncate max-w-[160px]">{learner.name}</p>
                        <p className="text-xs text-gray-400 truncate max-w-[160px]">{learner.email}</p>
                        {/* Mini progress bar */}
                        <div className="mt-1 flex items-center gap-1.5">
                          <div className="flex-1 h-1 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${pct === 100 ? "bg-green-500" : pct > 0 ? "bg-blue-400" : "bg-gray-200"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400 tabular-nums">{pct}%</span>
                        </div>
                      </td>

                      {/* Per-lesson cells */}
                      {lessonMeta.map((l) => {
                        const data = learner.lessons[l.id] ?? { completed: false, seconds: 0 };
                        return (
                          <td
                            key={l.id}
                            className={`px-0 text-center border-l border-gray-50 ${data.completed ? "bg-green-50" : data.seconds > 0 ? "bg-amber-50" : ""}`}
                          >
                            <Cell
                              completed={data.completed}
                              seconds={data.seconds}
                              hasVideo={l.hasVideo}
                            />
                          </td>
                        );
                      })}

                      {/* Summary */}
                      <td className="px-3 py-2 text-right border-l">
                        <span className={`text-sm font-semibold tabular-nums ${pct === 100 ? "text-green-600" : "text-gray-700"}`}>
                          {learner.completedCount}/{totalLessons}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="text-sm text-gray-600 tabular-nums">{fmt(learner.totalSeconds)}</span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="text-xs text-gray-500 tabular-nums">{fmt(learner.videoSeconds)}</span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="text-xs text-gray-500 tabular-nums">{fmt(learner.readingSeconds)}</span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Link
                          href={`/admin/courses/${courseId}/learners/${learner.userId}`}
                          className="text-xs text-brand-600 hover:underline font-medium"
                        >
                          →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="px-5 py-3 border-t bg-gray-50 flex flex-wrap gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="text-green-600 font-bold">✓</span> Completed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-amber-500 font-medium">▶ Xm</span> In progress (time logged, not marked complete)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-gray-300">—</span> Not visited
            </span>
            <span className="ml-auto">▶ = video lesson · 📖 = reading/content</span>
          </div>
        </div>
      )}
    </div>
  );
}
