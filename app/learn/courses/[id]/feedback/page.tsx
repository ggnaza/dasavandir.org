import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const map: Record<string, { label: string; cls: string }> = {
    approved: { label: "Approved", cls: "bg-green-100 text-green-700" },
    needs_revision: { label: "Needs Revision", cls: "bg-amber-100 text-amber-700" },
    not_approved: { label: "Not Approved", cls: "bg-red-100 text-red-700" },
    submitted: { label: "Submitted", cls: "bg-blue-100 text-blue-700" },
    draft: { label: "Draft", cls: "bg-gray-100 text-gray-500" },
  };
  const s = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-500" };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>;
}

function ScoreColor(score: number) {
  return score >= 80 ? "text-green-600" : score >= 60 ? "text-amber-600" : "text-red-600";
}

export default async function FeedbackPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: course } = await admin.from("courses").select("id, title").eq("id", params.id).single();
  if (!course) notFound();

  const { data: enrollment } = await admin
    .from("enrollments")
    .select("id")
    .eq("user_id", user.id)
    .eq("course_id", params.id)
    .maybeSingle();
  if (!enrollment) redirect(`/courses/${params.id}`);

  // Get all lessons for this course
  const { data: lessons } = await admin
    .from("lessons")
    .select("id, title, order")
    .eq("course_id", params.id)
    .order("order");

  const lessonIds = (lessons ?? []).map((l) => l.id);

  const [{ data: assignments }, { data: capstone }, { data: quizzes }] = await Promise.all([
    lessonIds.length > 0
      ? admin.from("assignments").select("id, title, lesson_id").in("lesson_id", lessonIds)
      : Promise.resolve({ data: [] as { id: string; title: string; lesson_id: string }[] }),
    admin.from("capstones").select("id, title").eq("course_id", params.id).single(),
    lessonIds.length > 0
      ? admin.from("quizzes").select("id, lesson_id").in("lesson_id", lessonIds)
      : Promise.resolve({ data: [] as { id: string; lesson_id: string }[] }),
  ]);

  const assignmentIds = (assignments ?? []).map((a) => a.id);
  const quizIds = (quizzes ?? []).map((q) => q.id);

  const [{ data: submissions }, { data: capstoneSubmission }, { data: quizResponses }] =
    await Promise.all([
      assignmentIds.length > 0
        ? admin
            .from("submissions")
            .select(
              "id, assignment_id, status, final_score, ai_total_score, final_feedback, instructor_note, created_at, updated_at"
            )
            .eq("user_id", user.id)
            .in("assignment_id", assignmentIds)
            .order("updated_at", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      capstone
        ? admin
            .from("capstone_submissions")
            .select("id, status, final_score, final_feedback, instructor_note, created_at, updated_at")
            .eq("user_id", user.id)
            .eq("capstone_id", capstone.id)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      quizIds.length > 0
        ? admin
            .from("quiz_responses")
            .select("id, quiz_id, score, submitted_at")
            .eq("user_id", user.id)
            .in("quiz_id", quizIds)
            .order("submitted_at", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
    ]);

  const lessonMap = Object.fromEntries((lessons ?? []).map((l) => [l.id, l]));
  const assignmentMap = Object.fromEntries(
    (assignments ?? []).map((a) => [a.id, { ...a, lesson: lessonMap[a.lesson_id] }])
  );

  // Build quiz results keyed by lesson_id
  const quizLessonMap: Record<string, string> = {};
  for (const q of quizzes ?? []) quizLessonMap[q.id] = q.lesson_id;

  const quizResultsByLesson: Record<string, { score: number; submitted_at: string }[]> = {};
  for (const r of quizResponses ?? []) {
    const lid = quizLessonMap[r.quiz_id];
    if (lid) {
      if (!quizResultsByLesson[lid]) quizResultsByLesson[lid] = [];
      quizResultsByLesson[lid].push({ score: r.score, submitted_at: r.submitted_at });
    }
  }

  // Summary stats
  const quizAttemptCount = (quizResponses ?? []).length;
  const avgQuizScore =
    quizAttemptCount > 0
      ? Math.round(
          (quizResponses ?? []).reduce((sum, r) => sum + r.score, 0) / quizAttemptCount
        )
      : null;

  const approvedCount = (submissions ?? []).filter((s) => s.status === "approved").length;
  const submittedCount = (submissions ?? []).length;
  const pendingCount = (submissions ?? []).filter(
    (s) => s.status === "submitted" || s.status === "ai_reviewed"
  ).length;

  const hasQuizzes = Object.keys(quizResultsByLesson).length > 0;
  const hasSubmissions = (submissions ?? []).length > 0;
  const hasAnything = hasQuizzes || hasSubmissions || capstoneSubmission;

  return (
    <div className="max-w-2xl">
      <Link href={`/learn/courses/${params.id}`} className="text-sm text-gray-500 hover:text-gray-700">
        ← {course.title}
      </Link>
      <h1 className="text-2xl font-bold mt-2 mb-1">My Grades & Feedback</h1>
      <p className="text-gray-500 text-sm mb-6">
        Your quiz scores, assignment grades, and facilitator feedback.
      </p>

      {/* Summary stats */}
      {hasAnything && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-7">
          {avgQuizScore !== null && (
            <div className="bg-white border rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Avg quiz score</p>
              <p className={`text-2xl font-bold ${ScoreColor(avgQuizScore)}`}>{avgQuizScore}%</p>
              <p className="text-xs text-gray-400 mt-0.5">{quizAttemptCount} attempt{quizAttemptCount !== 1 ? "s" : ""}</p>
            </div>
          )}
          {submittedCount > 0 && (
            <div className="bg-white border rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Assignments</p>
              <p className="text-2xl font-bold text-gray-900">{approvedCount}/{submittedCount}</p>
              <p className="text-xs text-gray-400 mt-0.5">approved</p>
            </div>
          )}
          {pendingCount > 0 && (
            <div className="bg-white border rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Awaiting review</p>
              <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
              <p className="text-xs text-gray-400 mt-0.5">assignment{pendingCount !== 1 ? "s" : ""}</p>
            </div>
          )}
        </div>
      )}

      {!hasAnything && (
        <div className="bg-white border rounded-xl p-10 text-center text-gray-400">
          No grades yet. Complete quizzes and assignments in each module to see them here.
        </div>
      )}

      {/* Quiz Results */}
      {hasQuizzes && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Quiz Results
          </h2>
          <div className="space-y-3">
            {(lessons ?? [])
              .filter((l) => quizResultsByLesson[l.id])
              .map((lesson) => {
                const attempts = quizResultsByLesson[lesson.id];
                // Most recent first; find best
                const best = Math.max(...attempts.map((a) => a.score));
                return (
                  <div key={lesson.id} className="bg-white border rounded-xl px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Module {lesson.order}</p>
                        <p className="font-semibold text-gray-900">{lesson.title}</p>
                      </div>
                      <span className={`text-xl font-bold shrink-0 ${ScoreColor(best)}`}>
                        {best}%
                      </span>
                    </div>
                    <div className="mt-2 space-y-1">
                      {attempts.map((a, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs text-gray-400">
                          <span>
                            Attempt {attempts.length - idx}
                            {a.score === best && attempts.length > 1 && (
                              <span className="ml-1 text-green-600 font-medium">· best</span>
                            )}
                          </span>
                          <span>
                            <span className={`font-medium ${ScoreColor(a.score)}`}>{a.score}%</span>
                            <span className="ml-2">
                              {new Date(a.submitted_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      )}

      {/* Assignment Submissions */}
      {hasSubmissions && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Assignment Submissions
          </h2>
          <div className="space-y-4">
            {(submissions ?? []).map((sub) => {
              const a = assignmentMap[sub.assignment_id];
              const score = sub.final_score ?? sub.ai_total_score;
              const feedback = sub.final_feedback as Array<{
                criterion: string;
                feedback: string;
                score: number;
                max_points: number;
              }> | null;
              return (
                <div key={sub.id} className="bg-white border rounded-xl overflow-hidden">
                  <div className="px-5 py-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">
                        Module {a?.lesson?.order} · {a?.lesson?.title}
                      </p>
                      <p className="font-semibold text-gray-900">{a?.title ?? "Assignment"}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {score !== null && score !== undefined && (
                        <span className={`text-sm font-bold ${ScoreColor(score)}`}>{score}%</span>
                      )}
                      <StatusBadge status={sub.status} />
                    </div>
                  </div>

                  {(sub.instructor_note || (feedback && feedback.length > 0)) && (
                    <div className="border-t px-5 py-4 bg-gray-50 space-y-3">
                      {sub.instructor_note && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                            Facilitator note
                          </p>
                          <p className="text-sm text-gray-700">{sub.instructor_note}</p>
                        </div>
                      )}
                      {feedback && feedback.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                            Detailed feedback
                          </p>
                          <div className="space-y-2">
                            {feedback.map((f, i) => (
                              <div key={i} className="text-sm">
                                <span className="font-medium text-gray-800">{f.criterion}</span>
                                {f.score !== undefined && f.max_points !== undefined && (
                                  <span className="text-gray-400 ml-1">
                                    ({f.score}/{f.max_points})
                                  </span>
                                )}
                                {f.feedback && (
                                  <p className="text-gray-600 mt-0.5">{f.feedback}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {sub.status === "needs_revision" && (
                    <div className="border-t px-5 py-3 bg-amber-50">
                      <Link
                        href={`/learn/courses/${params.id}/lessons/${a?.lesson_id}/assignment`}
                        className="text-sm text-amber-700 font-medium hover:underline"
                      >
                        Revise and resubmit →
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Capstone */}
      {capstoneSubmission && capstone && (
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Capstone Project
          </h2>
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="px-5 py-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Final project</p>
                <p className="font-semibold text-gray-900">{capstone.title ?? "Capstone"}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {capstoneSubmission.final_score != null && (
                  <span className={`text-sm font-bold ${ScoreColor(capstoneSubmission.final_score)}`}>
                    {capstoneSubmission.final_score}%
                  </span>
                )}
                <StatusBadge status={capstoneSubmission.status} />
              </div>
            </div>
            {capstoneSubmission.instructor_note && (
              <div className="border-t px-5 py-4 bg-gray-50">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Facilitator note
                </p>
                <p className="text-sm text-gray-700">{capstoneSubmission.instructor_note}</p>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
