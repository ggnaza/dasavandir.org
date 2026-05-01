import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-300 text-sm">—</span>;
  const color = score >= 80 ? "text-green-700 bg-green-50 border-green-200" : score >= 60 ? "text-yellow-700 bg-yellow-50 border-yellow-200" : "text-red-700 bg-red-50 border-red-200";
  return <span className={`text-sm font-semibold px-2.5 py-0.5 rounded-full border ${color}`}>{score}%</span>;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function LearnerDetailPage({ params }: { params: { id: string; userId: string } }) {
  const admin = createAdminClient();

  const [{ data: course }, { data: profile }, { data: enrollment }, { data: lessons }] = await Promise.all([
    admin.from("courses").select("id, title").eq("id", params.id).single(),
    admin.from("profiles").select("id, full_name, email").eq("id", params.userId).single(),
    admin.from("enrollments").select("enrolled_at").eq("course_id", params.id).eq("user_id", params.userId).single(),
    admin.from("lessons").select("id, title, order").eq("course_id", params.id).order("order"),
  ]);

  if (!course || !profile) notFound();

  const lessonIds = (lessons ?? []).map((l) => l.id);

  const [
    { data: progress },
    { data: quizzes },
    { data: quizResponses },
    { data: assignments },
    { data: submissions },
  ] = await Promise.all([
    admin.from("progress").select("lesson_id, completed_at").eq("user_id", params.userId).in("lesson_id", lessonIds),
    admin.from("quizzes").select("id, lesson_id").in("lesson_id", lessonIds),
    admin.from("quiz_responses").select("quiz_id, score, submitted_at").eq("user_id", params.userId).order("submitted_at", { ascending: false }),
    admin.from("assignments").select("id, lesson_id, title, max_score").in("lesson_id", lessonIds),
    admin.from("submissions").select("assignment_id, final_score, ai_total_score, status, submitted_at, instructor_note, final_feedback").eq("user_id", params.userId),
  ]);

  const completedMap = new Map((progress ?? []).map((p) => [p.lesson_id, p.completed_at]));
  const quizByLesson = new Map((quizzes ?? []).map((q) => [q.lesson_id, q.id]));
  const assignmentByLesson = new Map((assignments ?? []).map((a) => [a.lesson_id, a]));

  // Group quiz attempts per quiz id, latest first
  const quizAttemptsMap: Record<string, number[]> = {};
  for (const r of quizResponses ?? []) {
    if (!quizAttemptsMap[r.quiz_id]) quizAttemptsMap[r.quiz_id] = [];
    quizAttemptsMap[r.quiz_id].push(r.score ?? 0);
  }

  const submissionByAssignment = new Map((submissions ?? []).map((s) => [s.assignment_id, s]));

  const lessonList = lessons ?? [];

  // Build per-lesson data
  const lessonData = lessonList.map((lesson) => {
    const completedAt = completedMap.get(lesson.id) ?? null;
    const quizId = quizByLesson.get(lesson.id) ?? null;
    const assignment = assignmentByLesson.get(lesson.id) ?? null;
    const quizAttempts = quizId ? (quizAttemptsMap[quizId] ?? []) : [];
    const submission = assignment ? (submissionByAssignment.get(assignment.id) ?? null) : null;
    const assignmentScore = submission ? (submission.final_score ?? submission.ai_total_score ?? null) : null;
    const assignPct = assignmentScore !== null && assignment?.max_score
      ? Math.round((assignmentScore / assignment.max_score) * 100)
      : null;

    return { lesson, completedAt, quizId, quizAttempts, assignment, submission, assignmentScore, assignPct };
  });

  // Summary stats
  const completedCount = lessonData.filter((l) => l.completedAt).length;
  const completionPct = lessonList.length > 0 ? Math.round((completedCount / lessonList.length) * 100) : 0;

  const quizScores = lessonData.filter((l) => l.quizAttempts.length > 0).map((l) => l.quizAttempts[0]);
  const avgQuiz = quizScores.length > 0 ? Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length) : null;

  const assignScores = lessonData.filter((l) => l.assignPct !== null).map((l) => l.assignPct as number);
  const avgAssignment = assignScores.length > 0 ? Math.round(assignScores.reduce((a, b) => a + b, 0) / assignScores.length) : null;

  const allScores = [...quizScores, ...assignScores];
  const overallScore = allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : null;

  return (
    <div className="max-w-3xl">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link href={`/admin/courses/${params.id}/learners`} className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to students
        </Link>
        <div className="mt-2">
          <h1 className="text-2xl font-bold">{profile.full_name || profile.email}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {profile.email} · Enrolled {enrollment ? formatDate(enrollment.enrolled_at) : "—"} · {course.title}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        <div className="bg-white border rounded-xl p-4 text-center">
          <p className="text-xs text-gray-500">Completion</p>
          <p className="text-2xl font-bold mt-1">{completionPct}%</p>
          <p className="text-xs text-gray-400">{completedCount}/{lessonList.length} lessons</p>
        </div>
        <div className="bg-white border rounded-xl p-4 text-center">
          <p className="text-xs text-gray-500">Quiz avg</p>
          <p className="text-2xl font-bold mt-1">{avgQuiz !== null ? `${avgQuiz}%` : "—"}</p>
        </div>
        <div className="bg-white border rounded-xl p-4 text-center">
          <p className="text-xs text-gray-500">Assignment avg</p>
          <p className="text-2xl font-bold mt-1">{avgAssignment !== null ? `${avgAssignment}%` : "—"}</p>
        </div>
        <div className={`border rounded-xl p-4 text-center ${overallScore !== null && overallScore >= 80 ? "bg-green-50 border-green-200" : overallScore !== null && overallScore >= 60 ? "bg-yellow-50 border-yellow-200" : "bg-white"}`}>
          <p className="text-xs text-gray-500">Overall score</p>
          <p className="text-2xl font-bold mt-1">{overallScore !== null ? `${overallScore}%` : "—"}</p>
        </div>
      </div>

      {/* Lesson breakdown */}
      <div className="space-y-3">
        {lessonData.map(({ lesson, completedAt, quizAttempts, assignment, submission, assignmentScore, assignPct }, i) => (
          <div key={lesson.id} className="bg-white border rounded-xl overflow-hidden">
            {/* Lesson header */}
            <div className={`flex items-center justify-between px-5 py-3 ${completedAt ? "bg-green-50 border-b border-green-100" : "bg-gray-50 border-b"}`}>
              <div className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${completedAt ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"}`}>
                  {completedAt ? "✓" : i + 1}
                </span>
                <span className="font-medium text-sm">{lesson.title}</span>
              </div>
              {completedAt && (
                <span className="text-xs text-green-600">Completed {formatDate(completedAt)}</span>
              )}
            </div>

            <div className="px-5 py-4 grid grid-cols-2 gap-6">
              {/* Quiz */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Quiz</p>
                {quizAttempts.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">{quizByLesson.has(lesson.id) ? "Not taken" : "No quiz"}</p>
                ) : (
                  <div className="space-y-1">
                    {quizAttempts.map((score, ai) => (
                      <div key={ai} className="flex items-center gap-2">
                        <ScoreBadge score={score} />
                        <span className="text-xs text-gray-400">
                          {ai === 0 ? "Latest attempt" : `Attempt ${quizAttempts.length - ai}`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Assignment */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Assignment{assignment ? ` — ${assignment.title}` : ""}
                </p>
                {!assignment ? (
                  <p className="text-sm text-gray-400 italic">No assignment</p>
                ) : !submission ? (
                  <p className="text-sm text-gray-400 italic">Not submitted</p>
                ) : (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <ScoreBadge score={assignPct} />
                      <span className="text-xs text-gray-400">
                        {assignmentScore}/{assignment.max_score} pts
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        submission.status === "approved" ? "bg-green-100 text-green-700" :
                        submission.status === "returned" ? "bg-red-100 text-red-700" :
                        submission.status === "ai_reviewed" ? "bg-blue-100 text-blue-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>
                        {submission.status?.replace("_", " ")}
                      </span>
                    </div>
                    {submission.instructor_note && (
                      <p className="text-xs text-gray-500 mt-1">Note: {submission.instructor_note}</p>
                    )}
                    {submission.final_feedback && (
                      <p className="text-xs text-gray-500 mt-1">Feedback: {submission.final_feedback}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
