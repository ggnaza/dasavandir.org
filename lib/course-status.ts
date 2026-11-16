// Course lifecycle status, set by course staff in the course editor.
// Column: courses.status (supabase/migrations/course_status.sql).
//   active    — normal
//   completed — the course/cohort has finished; still fully viewable
//   archived  — finished and put away; still viewable by enrolled learners,
//               hidden from the public catalog
// Completed and archived courses sink to the bottom of every course list.

export const COURSE_STATUSES = ["active", "completed", "archived"] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];

export function normalizeCourseStatus(v: unknown): CourseStatus {
  return (COURSE_STATUSES as readonly unknown[]).includes(v) ? (v as CourseStatus) : "active";
}

const RANK: Record<CourseStatus, number> = { active: 0, completed: 1, archived: 2 };

/**
 * Stable sort: active first, then completed, then archived; the original order
 * (e.g. newest first) is kept within each group. `extraRank` lets a caller push
 * an item down a step within "active" (e.g. a learner who finished every lesson).
 */
export function sortByCourseStatus<T extends { status?: unknown }>(
  items: T[],
  extraRank: (item: T) => number = () => 0,
): T[] {
  const key = (t: T) => {
    const s = normalizeCourseStatus(t.status);
    return s === "active" ? extraRank(t) * 0.5 : RANK[s];
  };
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => key(a.item) - key(b.item) || a.i - b.i)
    .map(({ item }) => item);
}

export const COURSE_STATUS_LABEL: Record<CourseStatus, string> = {
  active: "Active",
  completed: "Completed",
  archived: "Archived",
};

export const COURSE_STATUS_BADGE: Record<CourseStatus, string> = {
  active: "",
  completed: "bg-blue-100 text-blue-700",
  archived: "bg-amber-100 text-amber-800",
};
