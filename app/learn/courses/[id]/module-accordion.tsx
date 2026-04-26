"use client";
import { useState } from "react";
import Link from "next/link";

type Lesson = {
  id: string;
  title: string;
  order: number;
  what_you_learn: string | null;
  skills: string[] | null;
};

export function ModuleAccordion({
  lessons,
  courseId,
  completedIds,
}: {
  lessons: Lesson[];
  courseId: string;
  completedIds: Set<string>;
}) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="divide-y">
      {lessons.map((lesson, i) => {
        const done = completedIds.has(lesson.id);
        const isOpen = open === lesson.id;
        const hasDetails = lesson.what_you_learn || (lesson.skills && lesson.skills.length > 0);

        return (
          <div key={lesson.id}>
            <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${
                  done ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <Link
                href={`/learn/courses/${courseId}/lessons/${lesson.id}`}
                className="flex-1 text-sm font-medium text-gray-900 hover:text-brand-600"
              >
                {lesson.title}
              </Link>
              {hasDetails && (
                <button
                  onClick={() => setOpen(isOpen ? null : lesson.id)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded"
                  aria-label={isOpen ? "Collapse" : "Expand"}
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              )}
            </div>

            {isOpen && hasDetails && (
              <div className="px-4 pb-4 ml-9 space-y-3 bg-gray-50 border-t">
                {lesson.what_you_learn && (
                  <div className="pt-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                      What you'll learn
                    </p>
                    <p className="text-sm text-gray-700 leading-relaxed">{lesson.what_you_learn}</p>
                  </div>
                )}
                {lesson.skills && lesson.skills.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Skills you'll gain
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {lesson.skills.map((skill, si) => (
                        <span
                          key={si}
                          className="text-xs px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
