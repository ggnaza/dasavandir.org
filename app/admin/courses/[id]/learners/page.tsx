import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { LearnerRows } from "./learner-rows";
import { InviteStudentsButton } from "./invite-students-modal";
import { EnrollLearnersButton } from "./enroll-learners-modal";
import { getModeratorCohort } from "@/lib/get-moderator-cohort";
import { clampSessionSeconds } from "@/lib/session-time";

export const dynamic = "force-dynamic";

export default async function CourseLearnerPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return notFound();

  const { data: viewerProfile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  const viewerRole = viewerProfile?.role ?? "";

  // course_manager sees only their assigned cohort; others see all
  const cohortIds = await getModeratorCohort(user.id, params.id, viewerRole);
  // A moderator (cohortIds !== null) is always scoped to their group members —
  // even an empty set (they see no learners until they have group members).
  const isCohortLimited = cohortIds !== null;

  const [{ data: course }, { data: lessons }, { data: allEnrollments }, { data: invitations }] = await Promise.all([
    admin.from("courses").select("id, title").eq("id", params.id).single(),
    admin.from("lessons").select("id, title, order").eq("course_id", params.id).order("order"),
    admin
      .from("enrollments")
      .select("user_id, enrolled_at")
      .eq("course_id", params.id)
      .order("enrolled_at", { ascending: false }),
    viewerRole !== "course_manager"
      ? admin
          .from("invitations")
          .select("id, email, first_name, last_name, status, created_at")
          .eq("course_id", params.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  if (!course) notFound();

  // Filter enrollments to cohort only if the moderator has an explicit cohort.
  // No cohort = see all enrolled learners in the assigned course (course access
  // is the gate; the cohort is an optional narrowing).
  const enrollments = isCohortLimited
    ? (allEnrollments ?? []).filter((e) => cohortIds!.includes(e.user_id))
    : (allEnrollments ?? []);

  if (!course) notFound();

  const userIds = (enrollments ?? []).map((e) => e.user_id);

  const lessonIds = (lessons ?? []).map((l) => l.id);

  const [{ data: profiles }, { data: allProgress }, { data: allSessions }] = await Promise.all([
    userIds.length > 0
      ? admin.from("profiles").select("id, full_name, email").in("id", userIds)
      : Promise.resolve({ data: [] }),
    userIds.length > 0
      ? admin.from("progress").select("user_id, lesson_id").in("user_id", userIds)
      : Promise.resolve({ data: [] }),
    userIds.length > 0 && lessonIds.length > 0
      ? admin.from("lesson_sessions").select("user_id, duration_seconds, created_at").in("user_id", userIds).in("lesson_id", lessonIds)
      : Promise.resolve({ data: [] }),
  ]);

  // Sum session time per learner, and track the most recent activity for presence.
  // A learner is "online" if a session heartbeat landed in the last few minutes
  // (the lesson tracker flushes ~every 30s while actively studying).
  const ONLINE_WINDOW_MS = 3 * 60_000;
  const nowMs = Date.now();
  const timeMap: Record<string, number> = {};
  const lastSeenMap: Record<string, number> = {};
  for (const s of allSessions ?? []) {
    timeMap[s.user_id] = (timeMap[s.user_id] ?? 0) + clampSessionSeconds(s.duration_seconds);
    if (s.created_at) {
      const t = new Date(s.created_at).getTime();
      if (!lastSeenMap[s.user_id] || t > lastSeenMap[s.user_id]) lastSeenMap[s.user_id] = t;
    }
  }

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

  const lessonList = lessons ?? [];
  const totalLessons = lessonList.length;

  const learners = (enrollments ?? []).map((e) => {
    const profile = profileMap[e.user_id];
    const name = profile?.full_name || profile?.email || "Unknown";
    const email = profile?.email ?? "";
    const completedIds = new Set(
      (allProgress ?? []).filter((p) => p.user_id === e.user_id).map((p) => p.lesson_id)
    );
    const completedCount = lessonList.filter((l) => completedIds.has(l.id)).length;
    const pct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

    return {
      userId: e.user_id,
      name,
      email,
      enrolledAt: e.enrolled_at,
      completedCount,
      totalLessons,
      pct,
      completedIds: Array.from(completedIds),
      totalSeconds: timeMap[e.user_id] ?? 0,
      online: lastSeenMap[e.user_id] ? nowMs - lastSeenMap[e.user_id] < ONLINE_WINDOW_MS : false,
    };
  });

  const avgPct = learners.length > 0
    ? Math.round(learners.reduce((sum, l) => sum + l.pct, 0) / learners.length)
    : 0;

  const completedAll = learners.filter((l) => l.pct === 100).length;
  const pendingInvites = invitations ?? [];

  return (
    <div className="max-w-4xl">
      {isCohortLimited && (
        <div className="mb-4 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
          Showing learners in the groups you moderate ({cohortIds!.length} learner{cohortIds!.length !== 1 ? "s" : ""}).
        </div>
      )}
      <div className="mb-6">
        <Link href="/admin/courses" className="text-sm text-gray-500 hover:text-gray-700">← Back to courses</Link>
        <div className="flex items-center justify-between mt-2">
          <h1 className="text-2xl font-bold">{course.title}</h1>
          <div className="flex items-center gap-2">
            {viewerRole !== "course_manager" && (
              <>
                <EnrollLearnersButton courseId={course.id} enrolledIds={(allEnrollments ?? []).map((e) => e.user_id)} />
                <InviteStudentsButton courseId={course.id} />
              </>
            )}
            <Link
              href={`/admin/courses/${course.id}`}
              className="text-sm border rounded-lg px-4 py-2 hover:bg-gray-50 text-gray-600"
            >
              Edit course →
            </Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border rounded-xl p-5">
          <p className="text-sm text-gray-500">Enrolled</p>
          <p className="text-3xl font-bold mt-1">{learners.length}</p>
        </div>
        <div className="bg-white border rounded-xl p-5">
          <p className="text-sm text-gray-500">Avg. progress</p>
          <p className="text-3xl font-bold mt-1">{avgPct}%</p>
        </div>
        <div className="bg-white border rounded-xl p-5">
          <p className="text-sm text-gray-500">Completed</p>
          <p className="text-3xl font-bold mt-1">{completedAll}</p>
        </div>
      </div>

      {/* Learner list */}
      {learners.length === 0 && pendingInvites.length === 0 ? (
        <div className="bg-white border rounded-xl p-10 text-center text-gray-500">
          No learners enrolled yet.
        </div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50 grid grid-cols-12 gap-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <span className="col-span-3">Learner</span>
            <span className="col-span-4">Progress</span>
            <span className="col-span-2 text-right">Time spent</span>
            <span className="col-span-2 text-right">Enrolled</span>
            <span className="col-span-1" />
          </div>
          <LearnerRows
            learners={learners}
            lessons={lessonList}
            courseId={course.id}
            canManage={viewerRole !== "course_manager"}
          />

          {/* Pending invites */}
          {pendingInvites.map((inv) => {
            const name = [inv.first_name, inv.last_name].filter(Boolean).join(" ") || inv.email;
            return (
              <div key={inv.id} className="px-5 py-4 border-t grid grid-cols-12 gap-3 items-center text-sm">
                <div className="col-span-4">
                  <p className="font-medium text-gray-700">{name}</p>
                  <p className="text-xs text-gray-400">{inv.email}</p>
                </div>
                <div className="col-span-5 text-gray-400 text-xs italic">Waiting for account creation</div>
                <div className="col-span-2 text-right">
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                    Invited
                  </span>
                </div>
                <div className="col-span-1" />
              </div>
            );
          })}
        </div>
      )}

      {learners.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-500">
          <span className="font-medium text-gray-400">Progress:</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" /> On track (≥75%)</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400" /> In progress (30–74%)</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400" /> Needs attention (&lt;30%)</span>
          <span className="text-gray-300">·</span>
          <span className="flex items-center gap-1.5"><span className="text-[11px] font-semibold text-green-600">online</span> = active now</span>
        </div>
      )}
    </div>
  );
}
