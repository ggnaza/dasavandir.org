"use client";
import { useState } from "react";
import Link from "next/link";

type Lesson = {
  id: string;
  title: string;
  order: number;
  what_you_learn: string | null;
  skills: string[] | null;
  duration_seconds: number | null;
};

type LessonFile = { id: string; file_name: string; url: string };
type CourseResource = {
  id: string;
  title: string;
  url: string | null;
  file_name: string | null;
  description: string | null;
};

export function ModuleAccordion({
  lessons,
  courseId,
  completedIds,
  nextLessonId,
  cohortAvgPct,
  lessonFiles = {},
  courseResources = [],
  allowShuffled = false,
}: {
  lessons: Lesson[];
  courseId: string;
  completedIds: Set<string>;
  nextLessonId?: string | null;
  cohortAvgPct?: number | null;
  lessonFiles?: Record<string, LessonFile[]>;
  courseResources?: CourseResource[];
  allowShuffled?: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [resourcesOpen, setResourcesOpen] = useState(false);

  const total = lessons.length;
  // Fractional lesson count completed by cohort (0..total)
  const cohortPos =
    cohortAvgPct != null && total > 0 ? (cohortAvgPct / 100) * total : null;

  function formatDuration(seconds: number | null) {
    if (!seconds) return null;
    const m = Math.round(seconds / 60);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem ? `${h}h ${rem}m` : `${h}h`;
  }

  function resourceIcon(r: CourseResource) {
    if (r.file_name?.endsWith(".pdf")) return "📄";
    if (r.url?.includes("docs.google.com/document")) return "📝";
    if (r.url?.includes("docs.google.com/spreadsheets") || r.url?.includes("sheets")) return "📊";
    if (r.url?.includes("docs.google.com/presentation") || r.url?.includes("slides")) return "🖼";
    return "🔗";
  }

  return (
    <div className="divide-y">
      {lessons.map((lesson, i) => {
        const done = completedIds.has(lesson.id);
        // Sequential gate: locked if not shuffled AND any prior lesson is incomplete.
        // Mirrors the lesson-page sidebar so learners don't click ahead and get
        // silently redirected to the first incomplete lesson.
        const locked =
          !allowShuffled && i > 0 && !lessons.slice(0, i).every((pl) => completedIds.has(pl.id));
        const isCurrent = lesson.id === nextLessonId;
        const isOpen = open === lesson.id;
        // Locked lessons expose nothing downloadable — materials stay gated until
        // the previous lesson is complete (matches the lesson-page access gate).
        const files = locked ? [] : (lessonFiles[lesson.id] ?? []);
        const hasExpand =
          !locked &&
          (!!(lesson.what_you_learn || (lesson.skills && lesson.skills.length > 0)) ||
            files.length > 0);
        const duration = formatDuration(lesson.duration_seconds);

        // Show cohort marker after this lesson if cohortPos falls in (i, i+1]
        const showCohortMarker =
          cohortPos != null && cohortPos > i && cohortPos <= i + 1;

        return (
          <div key={lesson.id}>
            <div
              className={`flex items-center gap-3 px-4 py-3 transition hover:bg-gray-50 ${
                isCurrent ? "bg-brand-50 hover:bg-brand-50" : ""
              }`}
            >
              {/* Node indicator */}
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                  done
                    ? "bg-green-100 text-green-700"
                    : locked
                    ? "bg-gray-50 text-gray-300"
                    : isCurrent
                    ? "bg-brand-600 text-white ring-4 ring-brand-100"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {done ? "✓" : locked ? "🔒" : isCurrent ? "→" : i + 1}
              </span>

              {/* Title + meta */}
              <div className="flex-1 min-w-0">
                {locked ? (
                  <span className="text-sm font-medium text-gray-300 cursor-not-allowed">
                    {lesson.title}
                  </span>
                ) : (
                  <Link
                    href={`/learn/courses/${courseId}/lessons/${lesson.id}`}
                    className={`text-sm font-medium hover:text-brand-600 ${
                      isCurrent ? "text-brand-700" : done ? "text-gray-500" : "text-gray-900"
                    }`}
                  >
                    {lesson.title}
                  </Link>
                )}
                <div className="flex items-center gap-2 mt-0.5">
                  {locked ? (
                    <span className="text-xs text-gray-400">Complete previous module first</span>
                  ) : isCurrent && (
                    <span className="text-xs text-brand-600 font-medium">Your next module</span>
                  )}
                  {duration && !locked && (
                    <span className={`text-xs ${isCurrent ? "text-brand-400" : "text-gray-400"}`}>
                      {isCurrent && "·"} {duration}
                    </span>
                  )}
                </div>
              </div>

              {hasExpand && (
                <button
                  onClick={() => setOpen(isOpen ? null : lesson.id)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded shrink-0"
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

            {/* Expanded section */}
            {isOpen && hasExpand && (
              <div className="px-4 pb-4 ml-9 space-y-3 bg-gray-50 border-t">
                {lesson.what_you_learn && (
                  <div className="pt-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                      What you&apos;ll learn
                    </p>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {lesson.what_you_learn}
                    </p>
                  </div>
                )}
                {lesson.skills && lesson.skills.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Skills you&apos;ll gain
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
                {files.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Lesson materials
                    </p>
                    <div className="space-y-1.5">
                      {files.map((f) => (
                        <a
                          key={f.id}
                          href={f.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-brand-600 hover:text-brand-800 hover:underline"
                        >
                          <span>📎</span>
                          <span>{f.file_name}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Cohort average position marker */}
            {showCohortMarker && (
              <div className="flex items-center gap-2 px-4 py-1.5 bg-amber-50 border-t border-b border-amber-100">
                <div className="flex-1 h-px bg-amber-200" />
                <span className="text-xs text-amber-600 font-medium whitespace-nowrap">
                  cohort avg · {cohortAvgPct}%
                </span>
                <div className="flex-1 h-px bg-amber-200" />
              </div>
            )}
          </div>
        );
      })}

      {/* Course Resources row */}
      {courseResources.length > 0 && (
        <div>
          <button
            onClick={() => setResourcesOpen(!resourcesOpen)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition text-left"
          >
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-sm shrink-0 bg-gray-100">
              📚
            </span>
            <span className="flex-1 text-sm font-medium text-gray-700">
              Course Resources
            </span>
            <span className="text-xs text-gray-400 mr-1">
              {courseResources.length} item{courseResources.length !== 1 ? "s" : ""}
            </span>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${
                resourcesOpen ? "rotate-180" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {resourcesOpen && (
            <div className="px-4 pb-3 ml-9 bg-gray-50 border-t pt-2 space-y-0.5">
              {courseResources.map((r) => (
                <a
                  key={r.id}
                  href={r.url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 py-2.5 group"
                >
                  <span className="text-base mt-0.5 shrink-0">{resourceIcon(r)}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 group-hover:text-brand-600">
                      {r.title}
                    </p>
                    {r.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{r.description}</p>
                    )}
                  </div>
                  <span className="text-gray-300 group-hover:text-brand-400 text-xs shrink-0 mt-0.5">
                    ↗
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
