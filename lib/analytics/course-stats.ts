import type { SupabaseClient } from "@supabase/supabase-js";

/** One row per enrolled learner, as returned by the course_learner_stats RPC. */
type StatRow = {
  user_id: string;
  enrolled_at: string | null;
  lessons_done: number;
  seconds_spent: number;
  quiz_avg: number | null;
};

export type CourseStats = {
  me: {
    lessonsDone: number;
    hours: number;
    quizAvg: number | null;
    pacePerWeek: number | null;
    daysEnrolled: number | null;
  };
  /** Cohort = every OTHER enrolled learner. Null when this learner has no peers. */
  cohort: {
    size: number;
    lessonsMedian: number;
    hoursMedian: number;
    quizMedian: number | null;
    paceMedian: number | null;
  } | null;
};

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Postgres `numeric` and `bigint` arrive as strings over PostgREST. */
function num(v: unknown): number {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : 0;
}

function weeksSince(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const days = (now.getTime() - new Date(iso).getTime()) / 86_400_000;
  // Guard a future/same-day enrolment: a sub-day denominator makes pace explode.
  return days < 1 ? null : days / 7;
}

/**
 * Per-learner course stats plus the cohort medians, for the learner analytics panel.
 *
 * Aggregation happens in Postgres (see supabase/migrations/learner_analytics.sql).
 * Doing it here would mean pulling every lesson_sessions row for the course —
 * 10,168 of them for TLA 2026 — and PostgREST silently caps a read at 1000, which
 * yields a partial sample and a plausible, wrong median.
 *
 * Returns null when the RPC is unavailable (migration not yet applied) so callers
 * can hide the panel rather than render zeroes as though they were real.
 */
export async function getCourseStats(
  admin: SupabaseClient,
  courseId: string,
  userId: string,
  now: Date = new Date(),
): Promise<CourseStats | null> {
  const { data, error } = await admin.rpc("course_learner_stats", { p_course_id: courseId });

  if (error || !Array.isArray(data)) {
    // Most likely the migration has not been applied yet. Never throw: this panel
    // must not be able to take down the course page.
    console.error("[course-stats] course_learner_stats unavailable:", error?.message);
    return null;
  }

  const rows = data as StatRow[];
  const mine = rows.find((r) => r.user_id === userId);
  if (!mine) return null;

  const myWeeks = weeksSince(mine.enrolled_at, now);
  const myLessons = num(mine.lessons_done);

  const me = {
    lessonsDone: myLessons,
    hours: num(mine.seconds_spent) / 3600,
    quizAvg: mine.quiz_avg === null ? null : num(mine.quiz_avg),
    pacePerWeek: myWeeks ? myLessons / myWeeks : null,
    daysEnrolled: mine.enrolled_at
      ? Math.floor((now.getTime() - new Date(mine.enrolled_at).getTime()) / 86_400_000)
      : null,
  };

  const peers = rows.filter((r) => r.user_id !== userId);
  if (peers.length === 0) return { me, cohort: null };

  // Pace is normalised per learner before taking the median: enrolment dates on a
  // single course span weeks (12 May – 6 July on TLA 2026, a 7x spread in time
  // enrolled), so a median of raw lesson counts would rank seniority, not speed.
  const peerPaces = peers
    .map((r) => {
      const w = weeksSince(r.enrolled_at, now);
      return w ? num(r.lessons_done) / w : null;
    })
    .filter((p): p is number => p !== null);

  const peerQuiz = peers.filter((r) => r.quiz_avg !== null).map((r) => num(r.quiz_avg));

  return {
    me,
    cohort: {
      size: peers.length,
      lessonsMedian: median(peers.map((r) => num(r.lessons_done))),
      hoursMedian: median(peers.map((r) => num(r.seconds_spent) / 3600)),
      quizMedian: peerQuiz.length ? median(peerQuiz) : null,
      paceMedian: peerPaces.length ? median(peerPaces) : null,
    },
  };
}
