import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { getModeratorCohort } from "@/lib/get-moderator-cohort";
import { clampSessionSeconds } from "@/lib/session-time";
import { ProgressMatrix, type LessonMeta, type LearnerRow } from "./progress-matrix";

export const dynamic = "force-dynamic";

export default async function ProgressPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return notFound();

  const accessErr = await assertCourseOwner(params.id, user.id);
  if (accessErr) return accessErr;

  const { data: viewerProfile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  const cohortIds = await getModeratorCohort(user.id, params.id, viewerProfile?.role ?? "");
  // A moderator (cohortIds !== null) is always scoped to their group members.
  const isCohortLimited = cohortIds !== null;

  // Fetch course, lessons, and enrollments in parallel
  const [{ data: course }, { data: lessons }, { data: allEnrollments }] = await Promise.all([
    admin.from("courses").select("id, title").eq("id", params.id).single(),
    admin.from("lessons").select("id, title, order, video_url").eq("course_id", params.id).order("order"),
    admin.from("enrollments").select("user_id").eq("course_id", params.id),
  ]);

  if (!course) return notFound();

  // Filter to cohort if the moderator has an explicit cohort; otherwise they see
  // all enrolled learners in their assigned course (course access is the gate,
  // the cohort is an optional narrowing).
  const enrollments = isCohortLimited
    ? (allEnrollments ?? []).filter((e) => cohortIds!.includes(e.user_id))
    : (allEnrollments ?? []);

  const userIds = enrollments.map((e) => e.user_id);
  const lessonIds = (lessons ?? []).map((l) => l.id);

  // Fetch profiles, progress, lesson sessions, and AI coach sessions in parallel
  const [{ data: profiles }, { data: progressRows }, { data: sessions }, { data: coachSessions }] = await Promise.all([
    userIds.length > 0
      ? admin.from("profiles").select("id, full_name, email").in("id", userIds)
      : Promise.resolve({ data: [] }),
    userIds.length > 0 && lessonIds.length > 0
      ? admin.from("progress").select("user_id, lesson_id").in("user_id", userIds).in("lesson_id", lessonIds)
      : Promise.resolve({ data: [] }),
    userIds.length > 0 && lessonIds.length > 0
      ? admin
          .from("lesson_sessions")
          .select("user_id, lesson_id, duration_seconds")
          .in("user_id", userIds)
          .in("lesson_id", lessonIds)
      : Promise.resolve({ data: [] }),
    userIds.length > 0
      ? admin
          .from("ai_coach_sessions")
          .select("user_id, started_at, last_message_at, message_count")
          .eq("course_id", params.id)
          .in("user_id", userIds)
      : Promise.resolve({ data: [] }),
  ]);

  // Aggregate AI coach sessions per user for this course
  type CoachStats = { sessions: number; messages: number; durationSeconds: number; lastActive: string | null };
  const coachMap: Record<string, CoachStats> = {};
  for (const s of coachSessions ?? []) {
    if (!coachMap[s.user_id]) coachMap[s.user_id] = { sessions: 0, messages: 0, durationSeconds: 0, lastActive: null };
    const c = coachMap[s.user_id];
    c.sessions += 1;
    c.messages += s.message_count ?? 0;
    if (s.started_at && s.last_message_at) {
      c.durationSeconds += Math.max(0, Math.round(
        (new Date(s.last_message_at).getTime() - new Date(s.started_at).getTime()) / 1000
      ));
    }
    if (!c.lastActive || (s.last_message_at && s.last_message_at > c.lastActive)) {
      c.lastActive = s.last_message_at;
    }
  }

  // Build lesson meta
  const lessonMeta: LessonMeta[] = (lessons ?? []).map((l) => ({
    id: l.id,
    title: l.title,
    order: l.order,
    hasVideo: !!l.video_url,
  }));

  // Index: videoLessonIds set
  const videoLessonIds = new Set((lessons ?? []).filter((l) => l.video_url).map((l) => l.id));

  // Build per-user progress map: userId → lessonId → { completed, seconds }
  const progressMap: Record<string, Set<string>> = {};
  for (const p of progressRows ?? []) {
    if (!progressMap[p.user_id]) progressMap[p.user_id] = new Set();
    progressMap[p.user_id].add(p.lesson_id);
  }

  // Sum session time per user per lesson
  const timeMap: Record<string, Record<string, number>> = {};
  for (const s of sessions ?? []) {
    if (!timeMap[s.user_id]) timeMap[s.user_id] = {};
    timeMap[s.user_id][s.lesson_id] = (timeMap[s.user_id][s.lesson_id] ?? 0) + clampSessionSeconds(s.duration_seconds);
  }

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

  // Build learner rows
  const learnerRows: LearnerRow[] = userIds.map((uid) => {
    const profile = profileMap[uid];
    const completedSet = progressMap[uid] ?? new Set<string>();
    const userTimes = timeMap[uid] ?? {};

    const lessonsData: Record<string, { completed: boolean; seconds: number }> = {};
    let totalSeconds = 0;
    let videoSeconds = 0;
    let readingSeconds = 0;

    for (const l of lessons ?? []) {
      const seconds = userTimes[l.id] ?? 0;
      const completed = completedSet.has(l.id);
      lessonsData[l.id] = { completed, seconds };
      totalSeconds += seconds;
      if (videoLessonIds.has(l.id)) videoSeconds += seconds;
      else readingSeconds += seconds;
    }

    const coach = coachMap[uid] ?? { sessions: 0, messages: 0, durationSeconds: 0, lastActive: null };

    return {
      userId: uid,
      name: profile?.full_name || profile?.email || "Unknown",
      email: profile?.email ?? "",
      lessons: lessonsData,
      totalSeconds,
      videoSeconds,
      readingSeconds,
      completedCount: (lessons ?? []).filter((l) => completedSet.has(l.id)).length,
      coachSessions: coach.sessions,
      coachMessages: coach.messages,
      coachDurationSeconds: coach.durationSeconds,
      coachLastActive: coach.lastActive,
    };
  });

  return (
    <ProgressMatrix
      courseId={params.id}
      lessonMeta={lessonMeta}
      learners={learnerRows}
      isCohortLimited={isCohortLimited}
      cohortSize={cohortIds?.length ?? 0}
    />
  );
}
