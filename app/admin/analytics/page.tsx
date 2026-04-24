import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

function fmtTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

export default async function AnalyticsPage() {
  const admin = createAdminClient();

  const [
    { data: courses },
    { data: lessons },
    { data: learners },
    { data: progress },
    { data: quizResponses },
    { data: sessions },
    { data: submissions },
  ] = await Promise.all([
    admin.from("courses").select("id, title, published"),
    admin.from("lessons").select("id, course_id, title"),
    admin.from("profiles").select("id, full_name, created_at").eq("role", "learner").order("created_at", { ascending: false }),
    admin.from("progress").select("user_id, lesson_id, completed_at"),
    admin.from("quiz_responses").select("user_id, quiz_id, score, submitted_at"),
    admin.from("lesson_sessions").select("user_id, lesson_id, duration_seconds"),
    admin.from("submissions").select("user_id, status, ai_total_score"),
  ]);

  const totalLearners = learners?.length ?? 0;
  const totalCompletions = progress?.length ?? 0;
  const avgQuizScore = quizResponses?.length
    ? Math.round(quizResponses.reduce((s, r) => s + (r.score ?? 0), 0) / quizResponses.length)
    : null;
  const activeLearners = new Set(progress?.map((p) => p.user_id)).size;
  const totalTimeSeconds = (sessions ?? []).reduce((s, r) => s + (r.duration_seconds ?? 0), 0);
  const pendingReviews = (submissions ?? []).filter((s) => s.status === "ai_reviewed").length;

  // Per-course stats
  const courseStats = (courses ?? []).map((course) => {
    const courseLessons = lessons?.filter((l) => l.course_id === course.id) ?? [];
    const lessonIds = new Set(courseLessons.map((l) => l.id));
    const courseProgress = progress?.filter((p) => lessonIds.has(p.lesson_id)) ?? [];
    const learnersStarted = new Set(courseProgress.map((p) => p.user_id)).size;

    const completionsByUser: Record<string, number> = {};
    courseProgress.forEach((p) => {
      completionsByUser[p.user_id] = (completionsByUser[p.user_id] ?? 0) + 1;
    });
    const fullCompletions = Object.values(completionsByUser).filter(
      (count) => count >= courseLessons.length && courseLessons.length > 0
    ).length;

    const courseSessions = (sessions ?? []).filter((s) => lessonIds.has(s.lesson_id));
    const totalCourseTime = courseSessions.reduce((s, r) => s + (r.duration_seconds ?? 0), 0);

    const lessonStats = courseLessons.map((lesson) => {
      const done = courseProgress.filter((p) => p.lesson_id === lesson.id).length;
      const lessonTime = (sessions ?? [])
        .filter((s) => s.lesson_id === lesson.id)
        .reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0);
      return { ...lesson, completions: done, totalTime: lessonTime };
    }).sort((a, b) => b.completions - a.completions);

    return {
      ...course,
      lessonCount: courseLessons.length,
      learnersStarted,
      fullCompletions,
      lessonStats,
      totalTime: totalCourseTime,
    };
  });

  // Per-learner stats
  const learnerStats = (learners ?? []).map((learner) => {
    const done = progress?.filter((p) => p.user_id === learner.id).length ?? 0;
    const quizzes = quizResponses?.filter((r) => r.user_id === learner.id) ?? [];
    const avg = quizzes.length
      ? Math.round(quizzes.reduce((s, r) => s + (r.score ?? 0), 0) / quizzes.length)
      : null;
    const timeSpent = (sessions ?? [])
      .filter((s) => s.user_id === learner.id)
      .reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0);
    return { ...learner, lessonsCompleted: done, quizzesTaken: quizzes.length, avgScore: avg, timeSpent };
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <a
          href="/api/admin/export"
          className="text-sm border border-gray-300 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50"
        >
          Export CSV
        </a>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
        {[
          { label: "Total learners", value: totalLearners },
          { label: "Active learners", value: activeLearners },
          { label: "Lesson completions", value: totalCompletions },
          { label: "Avg quiz score", value: avgQuizScore !== null ? `${avgQuizScore}%` : "—" },
          { label: "Total time spent", value: totalTimeSeconds > 0 ? fmtTime(totalTimeSeconds) : "—" },
          { label: "Pending reviews", value: pendingReviews, urgent: pendingReviews > 0 },
        ].map((s) => (
          <div key={s.label} className={`bg-white border rounded-xl p-5 ${(s as any).urgent ? "border-orange-300" : ""}`}>
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 ${(s as any).urgent ? "text-orange-600" : ""}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {pendingReviews > 0 && (
        <div className="mb-8 bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center justify-between">
          <p className="text-orange-800 font-medium">
            {pendingReviews} assignment{pendingReviews > 1 ? "s" : ""} waiting for review
          </p>
          <Link href="/admin/submissions" className="text-sm text-orange-700 font-semibold hover:underline">
            Review now →
          </Link>
        </div>
      )}

      {/* Per-course breakdown */}
      <h2 className="text-lg font-semibold mb-4">Course breakdown</h2>
      <div className="space-y-4 mb-10">
        {courseStats.map((course) => (
          <div key={course.id} className="bg-white border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="font-semibold">{course.title}</span>
                <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${course.published ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {course.published ? "Published" : "Draft"}
                </span>
              </div>
              <div className="text-sm text-gray-500 text-right space-x-3">
                <span>{course.learnersStarted} started</span>
                <span>·</span>
                <span>{course.fullCompletions} finished</span>
                {course.totalTime > 0 && (
                  <>
                    <span>·</span>
                    <span>{fmtTime(course.totalTime)} total time</span>
                  </>
                )}
              </div>
            </div>

            {course.lessonStats.length > 0 && (
              <div className="space-y-1.5">
                {course.lessonStats.map((lesson) => {
                  const pct = course.learnersStarted
                    ? Math.round((lesson.completions / Math.max(course.learnersStarted, 1)) * 100)
                    : 0;
                  return (
                    <div key={lesson.id} className="flex items-center gap-3 text-sm">
                      <span className="text-gray-500 truncate w-48 shrink-0">{lesson.title}</span>
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full">
                        <div className="h-1.5 bg-brand-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-gray-400 text-xs w-10 text-right">{lesson.completions}</span>
                      {lesson.totalTime > 0 && (
                        <span className="text-gray-300 text-xs w-10 text-right">{fmtTime(lesson.totalTime)}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Learner table */}
      <h2 className="text-lg font-semibold mb-4">Learners</h2>
      <div className="bg-white border rounded-xl overflow-hidden">
        {learnerStats.length === 0 ? (
          <p className="text-gray-500 text-sm p-6">No learners yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Lessons done</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Quizzes</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Avg score</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Time spent</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {learnerStats.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{l.full_name ?? "—"}</td>
                  <td className="px-4 py-3 text-center">{l.lessonsCompleted}</td>
                  <td className="px-4 py-3 text-center">{l.quizzesTaken}</td>
                  <td className="px-4 py-3 text-center">
                    {l.avgScore !== null ? (
                      <span className={`font-medium ${l.avgScore >= 70 ? "text-green-600" : "text-orange-500"}`}>
                        {l.avgScore}%
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500">
                    {l.timeSpent > 0 ? fmtTime(l.timeSpent) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
