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

  // Get all lessons with assignments for this course
  const { data: lessons } = await admin
    .from("lessons")
    .select("id, title, order")
    .eq("course_id", params.id)
    .order("order");

  const lessonIds = (lessons ?? []).map((l) => l.id);

  const [{ data: assignments }, { data: capstone }] = await Promise.all([
    lessonIds.length > 0
      ? admin.from("assignments").select("id, title, lesson_id").in("lesson_id", lessonIds)
      : Promise.resolve({ data: [] }),
    admin.from("capstones").select("id, title").eq("course_id", params.id).single(),
  ]);

  const assignmentIds = (assignments ?? []).map((a) => a.id);

  const [{ data: submissions }, { data: capstoneSubmission }] = await Promise.all([
    assignmentIds.length > 0
      ? admin
          .from("submissions")
          .select("id, assignment_id, status, final_score, ai_total_score, final_feedback, instructor_note, created_at, updated_at")
          .eq("user_id", user.id)
          .in("assignment_id", assignmentIds)
          .order("updated_at", { ascending: false })
      : Promise.resolve({ data: [] }),
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
  ]);

  const lessonMap = Object.fromEntries((lessons ?? []).map((l) => [l.id, l]));
  const assignmentMap = Object.fromEntries((assignments ?? []).map((a) => [a.id, { ...a, lesson: lessonMap[a.lesson_id] }]));

  const hasAnything = (submissions ?? []).length > 0 || capstoneSubmission;

  return (
    <div className="max-w-2xl">
      <Link href={`/learn/courses/${params.id}`} className="text-sm text-gray-500 hover:text-gray-700">
        ← {course.title}
      </Link>
      <h1 className="text-2xl font-bold mt-2 mb-1">My Submissions</h1>
      <p className="text-gray-500 text-sm mb-6">Your submitted assignments and feedback from your facilitator.</p>

      {!hasAnything && (
        <div className="bg-white border rounded-xl p-10 text-center text-gray-400">
          No submissions yet. Complete assignments in each module to see them here.
        </div>
      )}

      <div className="space-y-4">
        {/* Assignment submissions */}
        {(submissions ?? []).map((sub) => {
          const a = assignmentMap[sub.assignment_id];
          const score = sub.final_score ?? sub.ai_total_score;
          const feedback = sub.final_feedback as Array<{ criterion: string; feedback: string; score: number; max_points: number }> | null;
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
                    <span className={`text-sm font-bold ${score >= 80 ? "text-green-600" : score >= 60 ? "text-amber-600" : "text-red-600"}`}>
                      {score}%
                    </span>
                  )}
                  <StatusBadge status={sub.status} />
                </div>
              </div>

              {(sub.instructor_note || (feedback && feedback.length > 0)) && (
                <div className="border-t px-5 py-4 bg-gray-50 space-y-3">
                  {sub.instructor_note && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Facilitator note</p>
                      <p className="text-sm text-gray-700">{sub.instructor_note}</p>
                    </div>
                  )}
                  {feedback && feedback.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Detailed feedback</p>
                      <div className="space-y-2">
                        {feedback.map((f, i) => (
                          <div key={i} className="text-sm">
                            <span className="font-medium text-gray-800">{f.criterion}</span>
                            {f.score !== undefined && f.max_points !== undefined && (
                              <span className="text-gray-400 ml-1">({f.score}/{f.max_points})</span>
                            )}
                            {f.feedback && <p className="text-gray-600 mt-0.5">{f.feedback}</p>}
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

        {/* Capstone submission */}
        {capstoneSubmission && capstone && (
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="px-5 py-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Capstone project</p>
                <p className="font-semibold text-gray-900">{capstone.title ?? "Final Project"}</p>
              </div>
              <StatusBadge status={capstoneSubmission.status} />
            </div>
            {(capstoneSubmission.instructor_note || capstoneSubmission.final_feedback) && (
              <div className="border-t px-5 py-4 bg-gray-50">
                {capstoneSubmission.instructor_note && (
                  <p className="text-sm text-gray-700">{capstoneSubmission.instructor_note}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
