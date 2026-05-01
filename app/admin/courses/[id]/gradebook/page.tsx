import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import { GradebookTable } from "./gradebook-table";

export const dynamic = "force-dynamic";

export default async function GradebookPage({ params }: { params: { id: string } }) {
  const admin = createAdminClient();

  const [{ data: course }, { data: lessons }, { data: enrollments }] = await Promise.all([
    admin.from("courses").select("id, title").eq("id", params.id).single(),
    admin.from("lessons").select("id, title, order").eq("course_id", params.id).order("order"),
    admin.from("enrollments").select("user_id, enrolled_at").eq("course_id", params.id),
  ]);

  if (!course) notFound();

  const userIds = (enrollments ?? []).map((e) => e.user_id);
  const lessonIds = (lessons ?? []).map((l) => l.id);

  if (userIds.length === 0) {
    return (
      <div className="max-w-4xl">
        <div className="mb-6">
          <Link href={`/admin/courses/${params.id}`} className="text-sm text-gray-500 hover:text-gray-700">← Back to course</Link>
          <h1 className="text-2xl font-bold mt-2">Gradebook</h1>
          <p className="text-sm text-gray-500">{course.title}</p>
        </div>
        <div className="bg-white border rounded-xl p-10 text-center text-gray-500">No students enrolled yet.</div>
      </div>
    );
  }

  // Fetch all grade data in parallel
  const [
    { data: profiles },
    { data: quizzes },
    { data: quizResponses },
    { data: assignments },
    { data: submissions },
    { data: progress },
  ] = await Promise.all([
    admin.from("profiles").select("id, full_name, email").in("id", userIds),
    admin.from("quizzes").select("id, lesson_id").in("lesson_id", lessonIds),
    admin.from("quiz_responses").select("quiz_id, user_id, score").in("user_id", userIds).order("submitted_at", { ascending: false }),
    admin.from("assignments").select("id, lesson_id, max_score").in("lesson_id", lessonIds),
    admin.from("submissions").select("assignment_id, user_id, final_score, ai_total_score, status").in("user_id", userIds),
    admin.from("progress").select("user_id, lesson_id").in("user_id", userIds),
  ]);

  // Build lookup maps
  const quizByLesson = Object.fromEntries((quizzes ?? []).map((q) => [q.lesson_id, q.id]));
  const lessonHasQuiz = new Set((quizzes ?? []).map((q) => q.lesson_id));
  const assignmentByLesson = Object.fromEntries((assignments ?? []).map((a) => [a.lesson_id, a]));
  const lessonHasAssignment = new Set((assignments ?? []).map((a) => a.lesson_id));

  // All attempts per user+quiz, ordered latest first (DB query already sorted desc)
  const quizAttemptsMap: Record<string, Record<string, number[]>> = {};
  for (const r of quizResponses ?? []) {
    if (!quizAttemptsMap[r.user_id]) quizAttemptsMap[r.user_id] = {};
    if (!quizAttemptsMap[r.user_id][r.quiz_id]) quizAttemptsMap[r.user_id][r.quiz_id] = [];
    quizAttemptsMap[r.user_id][r.quiz_id].push(r.score ?? 0);
  }

  type Submission = NonNullable<typeof submissions>[number];
  const submissionMap: Record<string, Record<string, Submission>> = {};
  for (const s of submissions ?? []) {
    if (!submissionMap[s.user_id]) submissionMap[s.user_id] = {};
    submissionMap[s.user_id][s.assignment_id] = s;
  }

  const completedMap: Record<string, Set<string>> = {};
  for (const p of progress ?? []) {
    if (!completedMap[p.user_id]) completedMap[p.user_id] = new Set();
    completedMap[p.user_id].add(p.lesson_id);
  }

  const lessonList = lessons ?? [];

  // Build per-student data
  const students = (enrollments ?? []).map((e) => {
    const profile = (profiles ?? []).find((p) => p.id === e.user_id);
    const name = profile?.full_name || profile?.email || "Unknown";
    const email = profile?.email ?? "";

    const lessonScores = lessonList.map((lesson) => {
      const quizId = quizByLesson[lesson.id];
      const assignment = assignmentByLesson[lesson.id];
      const completed = completedMap[e.user_id]?.has(lesson.id) ?? false;

      const hasQuiz = lessonHasQuiz.has(lesson.id);
      const quizAttempts: number[] = quizId ? (quizAttemptsMap[e.user_id]?.[quizId] ?? []) : [];
      const quizAttempted = quizAttempts.length > 0;
      const quizScore = quizAttempted ? quizAttempts[0] : null; // latest first

      const hasAssignment = lessonHasAssignment.has(lesson.id);
      const submission: Submission | null = assignment ? (submissionMap[e.user_id]?.[assignment.id] ?? null) : null;
      const assignmentScore = submission
        ? (submission.final_score ?? submission.ai_total_score ?? null)
        : null;
      const maxScore = assignment?.max_score ?? null;

      return {
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        completed,
        hasQuiz,
        quizAttempted,
        quizScore,
        quizAttempts,
        hasAssignment,
        assignmentScore,
        maxScore,
        submissionStatus: submission?.status ?? null,
      };
    });

    // Overall averages
    const quizScores = lessonScores.filter((l) => l.quizScore !== null).map((l) => l.quizScore as number);
    const assignScores = lessonScores
      .filter((l) => l.assignmentScore !== null && l.maxScore)
      .map((l) => Math.round(((l.assignmentScore as number) / (l.maxScore as number)) * 100));

    const avgQuiz = quizScores.length > 0 ? Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length) : null;
    const avgAssignment = assignScores.length > 0 ? Math.round(assignScores.reduce((a, b) => a + b, 0) / assignScores.length) : null;

    const allScores = [...quizScores, ...assignScores];
    const overallScore = allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : null;

    const completedCount = lessonScores.filter((l) => l.completed).length;

    return { userId: e.user_id, name, email, lessonScores, avgQuiz, avgAssignment, overallScore, completedCount };
  });

  // Class averages
  const classAvgScores = students.map((s) => s.overallScore).filter((s) => s !== null) as number[];
  const classAvg = classAvgScores.length > 0 ? Math.round(classAvgScores.reduce((a, b) => a + b, 0) / classAvgScores.length) : null;
  const classCompletion = students.length > 0
    ? Math.round((students.reduce((sum, s) => sum + s.completedCount, 0) / (students.length * lessonList.length || 1)) * 100)
    : 0;

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <Link href={`/admin/courses/${params.id}`} className="text-sm text-gray-500 hover:text-gray-700">← Back to course</Link>
        <div className="flex items-center justify-between mt-2">
          <div>
            <h1 className="text-2xl font-bold">Gradebook</h1>
            <p className="text-sm text-gray-500">{course.title}</p>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500">Students</p>
          <p className="text-2xl font-bold mt-1">{students.length}</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500">Class avg score</p>
          <p className="text-2xl font-bold mt-1">{classAvg !== null ? `${classAvg}%` : "—"}</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500">Completion rate</p>
          <p className="text-2xl font-bold mt-1">{classCompletion}%</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500">Lessons</p>
          <p className="text-2xl font-bold mt-1">{lessonList.length}</p>
        </div>
      </div>

      <GradebookTable students={students} />
    </div>
  );
}
