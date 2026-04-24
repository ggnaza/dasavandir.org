"use client";
import { useState } from "react";

type Lesson = {
  id: string;
  title: string;
  order: number;
  what_you_learn: string | null;
  skills: string[] | null;
};

export function ModuleList({ lessons }: { lessons: Lesson[] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="divide-y">
      {lessons.map((lesson, i) => {
        const isOpen = open === lesson.id;
        const hasDetails = lesson.what_you_learn || (lesson.skills && lesson.skills.length > 0);

        return (
          <div key={lesson.id}>
            <button
              className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition text-left"
              onClick={() => hasDetails && setOpen(isOpen ? null : lesson.id)}
              disabled={!hasDetails}
            >
              <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs flex items-center justify-center font-medium shrink-0">
                {i + 1}
              </span>
              <span className="flex-1 text-sm font-medium text-gray-900">{lesson.title}</span>
              {hasDetails && (
                <span className={`text-gray-400 text-sm transition-transform ${isOpen ? "rotate-180" : ""}`}>
                  ▾
                </span>
              )}
            </button>

            {isOpen && hasDetails && (
              <div className="px-6 pb-5 ml-10 space-y-4">
                {lesson.what_you_learn && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">What you'll learn</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{lesson.what_you_learn}</p>
                  </div>
                )}
                {lesson.skills && lesson.skills.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Skills you'll gain</p>
                    <div className="flex flex-wrap gap-2">
                      {lesson.skills.map((skill, si) => (
                        <span key={si} className="text-xs px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 font-medium">
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
