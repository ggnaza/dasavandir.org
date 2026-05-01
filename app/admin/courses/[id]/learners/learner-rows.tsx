"use client";
import Link from "next/link";

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

export function LearnerRows({ learners, lessons, courseId }: { learners: Learner[]; lessons: Lesson[]; courseId: string }) {
  return (
    <div className="divide-y">
      {learners.map((l) => (
        <Link
          key={l.userId}
          href={`/admin/courses/${courseId}/learners/${l.userId}`}
          className="grid grid-cols-12 gap-3 items-center px-5 py-4 hover:bg-gray-50 transition text-left"
        >
          <div className="col-span-4">
            <p className="text-sm font-medium text-gray-900 truncate">{l.name}</p>
            <p className="text-xs text-gray-400 truncate">{l.email}</p>
          </div>

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

          <span className="col-span-2 text-xs text-gray-400 text-right">
            {l.enrolledAt ? formatDate(l.enrolledAt) : "—"}
          </span>

          <span className="col-span-1 text-gray-400 text-sm text-right">→</span>
        </Link>
      ))}
    </div>
  );
}
