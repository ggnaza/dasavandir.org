import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  submitted:     "bg-gray-100 text-gray-600",
  ai_reviewed:   "bg-blue-100 text-blue-700",
  approved:      "bg-green-100 text-green-700",
  needs_revision:"bg-amber-100 text-amber-700",
  not_approved:  "bg-red-100 text-red-700",
  returned:      "bg-orange-100 text-orange-700",
};

const STATUS_LABELS: Record<string, string> = {
  submitted:      "Submitted",
  ai_reviewed:    "Needs review",
  approved:       "Approved",
  needs_revision: "Needs revision",
  not_approved:   "Not approved",
  returned:       "Returned",
};

const NEEDS_REVIEW = new Set(["submitted", "ai_reviewed", "needs_revision"]);

export default async function SubmissionsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role ?? "";
  if (!["admin", "course_creator", "course_manager"].includes(role)) redirect("/learn");

  // ── Determine which courses + learners are visible ──────────────────────────
  let courseIds: string[] | null = null; // null = all courses
  let learnerIds: string[] | null = null; // null = all learners in those courses

  if (role === "admin") {
    courseIds = null; // all
  } else if (role === "course_creator") {
    const { data: access } = await admin
      .from("course_creator_access")
      .select("course_id")
      .eq("creator_id", user.id);
    courseIds = (access ?? []).map((r) => r.course_id);
  } else {
    // course_manager (moderator): access gate is course_manager_access; the
    // learners they see are the members of the groups they moderate
    // (course_groups.moderator_id → course_group_members), unioned with any
    // legacy moderator_cohort_assignments rows.
    const [{ data: managerAccess }, { data: modGroups }, { data: cohortAssignments }] = await Promise.all([
      admin.from("course_manager_access").select("course_id").eq("manager_id", user.id),
      admin.from("course_groups").select("id").eq("moderator_id", user.id),
      admin.from("moderator_cohort_assignments").select("learner_id").eq("moderator_id", user.id),
    ]);
    courseIds = (managerAccess ?? []).map((r) => r.course_id);

    const groupIds = (modGroups ?? []).map((g) => g.id);
    const { data: groupMembers } = groupIds.length
      ? await admin.from("course_group_members").select("user_id").in("group_id", groupIds)
      : { data: [] as { user_id: string }[] };

    const ids = new Set<string>();
    (groupMembers ?? []).forEach((m: any) => ids.add(m.user_id));
    (cohortAssignments ?? []).forEach((a: any) => ids.add(a.learner_id));
    learnerIds = Array.from(ids);
  }

  // ── Load submissions ────────────────────────────────────────────────────────
  let query = admin
    .from("submissions")
    .select(`
      id, status, ai_total_score, final_score, submitted_at, user_id,
      profiles(full_name, email),
      assignment_id,
      assignments(title, lesson_id,
        lessons(id, title, order, course_id, courses(id, title)))
    `)
    .order("submitted_at", { ascending: false });

  if (courseIds !== null) {
    if (courseIds.length === 0) {
      // no courses visible
      return <EmptyPage message="No courses assigned to you." />;
    }
    // Filter by assignment lesson course
    // We need to filter indirectly — fetch assignment IDs for the courses
    const { data: lessons } = await admin
      .from("lessons")
      .select("id")
      .in("course_id", courseIds);
    const lessonIds = (lessons ?? []).map((l) => l.id);
    if (lessonIds.length === 0) return <EmptyPage message="No lessons in your courses yet." />;

    const { data: assignments } = await admin
      .from("assignments")
      .select("id")
      .in("lesson_id", lessonIds);
    const assignmentIds = (assignments ?? []).map((a) => a.id);
    if (assignmentIds.length === 0) return <EmptyPage message="No assignments in your courses yet." />;

    query = query.in("assignment_id", assignmentIds);
  }

  if (learnerIds !== null) {
    if (learnerIds.length === 0) return <EmptyPage message="No learners in the groups you moderate yet." />;
    query = query.in("user_id", learnerIds);
  }

  const { data: submissions, error: submissionsError } = await query;

  // Surface query failures instead of silently rendering an empty state (a
  // missing column previously made this show "No submissions yet" wrongly).
  if (submissionsError) {
    console.error("[admin/submissions] query failed", submissionsError);
    return <EmptyPage message="Couldn't load submissions. Please try again or contact support." />;
  }

  if (!submissions?.length) {
    return <EmptyPage message="No submissions yet." />;
  }

  // ── Group: course → lesson → submissions ────────────────────────────────────
  type SubRow = typeof submissions[number];

  const courseMap = new Map<string, { title: string; lessons: Map<string, { order: number; title: string; subs: SubRow[] }> }>();

  for (const sub of submissions) {
    const assignment = sub.assignments as any;
    const lesson = assignment?.lessons as any;
    const course = lesson?.courses as any;
    if (!course || !lesson) continue;

    if (!courseMap.has(course.id)) {
      courseMap.set(course.id, { title: course.title, lessons: new Map() });
    }
    const cm = courseMap.get(course.id)!;
    if (!cm.lessons.has(lesson.id)) {
      cm.lessons.set(lesson.id, { order: lesson.order, title: lesson.title, subs: [] });
    }
    cm.lessons.get(lesson.id)!.subs.push(sub);
  }

  const pendingTotal = submissions.filter((s) => NEEDS_REVIEW.has(s.status)).length;

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Submissions</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {submissions.length} total
            {pendingTotal > 0 && (
              <span className="ml-2 text-blue-600 font-medium">· {pendingTotal} need review</span>
            )}
          </p>
        </div>
      </div>

      <div className="space-y-8">
        {Array.from(courseMap.entries()).map(([courseId, courseData]) => {
          const sortedLessons = Array.from(courseData.lessons.entries()).sort(
            ([, a], [, b]) => a.order - b.order
          );
          const coursePending = sortedLessons.reduce(
            (sum, [, l]) => sum + l.subs.filter((s) => NEEDS_REVIEW.has(s.status)).length, 0
          );

          return (
            <div key={courseId}>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-base font-bold text-gray-800">{courseData.title}</h2>
                {coursePending > 0 && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                    {coursePending} to review
                  </span>
                )}
              </div>

              <div className="space-y-4">
                {sortedLessons.map(([lessonId, lessonData]) => {
                  const pending = lessonData.subs.filter((s) => NEEDS_REVIEW.has(s.status));
                  const done = lessonData.subs.filter((s) => !NEEDS_REVIEW.has(s.status));
                  const allSubs = [...pending, ...done]; // pending first

                  return (
                    <div key={lessonId} className="bg-white border rounded-xl overflow-hidden">
                      {/* Lesson header */}
                      <div className="px-5 py-3 bg-gray-50 border-b flex items-center justify-between">
                        <div>
                          <span className="text-xs text-gray-400 mr-2">Module {lessonData.order}</span>
                          <span className="text-sm font-semibold text-gray-800">{lessonData.title}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span>{allSubs.length} submission{allSubs.length !== 1 ? "s" : ""}</span>
                          {pending.length > 0 && (
                            <span className="text-blue-600 font-medium">{pending.length} pending</span>
                          )}
                        </div>
                      </div>

                      {/* Submission rows */}
                      <div className="divide-y">
                        {allSubs.map((sub) => {
                          const assignment = sub.assignments as any;
                          const p = sub.profiles as any;
                          const name = p?.full_name || p?.email || "Unknown";
                          const score = sub.final_score ?? sub.ai_total_score;
                          const isPending = NEEDS_REVIEW.has(sub.status);

                          return (
                            <div
                              key={sub.id}
                              className={`px-5 py-3 flex items-center gap-4 text-sm hover:bg-gray-50 transition-colors ${isPending ? "bg-blue-50/40" : ""}`}
                            >
                              {/* Learner name */}
                              <div className="w-44 shrink-0">
                                <p className="font-medium text-gray-900 truncate">{name}</p>
                              </div>

                              {/* Assignment title */}
                              <div className="flex-1 min-w-0">
                                <p className="text-gray-600 truncate text-xs">{assignment?.title}</p>
                              </div>

                              {/* Score */}
                              <div className="w-16 text-right shrink-0">
                                {score != null ? (
                                  <span className={`text-sm font-semibold ${score >= 80 ? "text-green-600" : score >= 60 ? "text-amber-600" : "text-red-600"}`}>
                                    {score}
                                  </span>
                                ) : (
                                  <span className="text-gray-300 text-xs">—</span>
                                )}
                              </div>

                              {/* Status */}
                              <div className="w-32 text-center shrink-0">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[sub.status] ?? "bg-gray-100 text-gray-500"}`}>
                                  {STATUS_LABELS[sub.status] ?? sub.status}
                                </span>
                              </div>

                              {/* Date */}
                              <div className="w-24 text-right text-xs text-gray-400 shrink-0">
                                {sub.submitted_at
                                  ? new Date(sub.submitted_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                                  : "—"}
                              </div>

                              {/* Action */}
                              <div className="w-20 text-right shrink-0">
                                <Link
                                  href={`/admin/submissions/${sub.id}`}
                                  className={`text-xs font-medium hover:underline ${isPending ? "text-blue-600" : "text-brand-600"}`}
                                >
                                  {isPending ? "Review →" : "View →"}
                                </Link>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmptyPage({ message }: { message: string }) {
  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-8">Submissions</h1>
      <div className="bg-white border rounded-xl p-12 text-center text-gray-400">{message}</div>
    </div>
  );
}
