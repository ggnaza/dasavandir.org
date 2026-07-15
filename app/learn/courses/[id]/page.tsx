import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ModuleAccordion } from "./module-accordion";
import { AiCoach } from "./ai-coach";
import { AnalyticsPanel } from "./analytics-panel";
import { getCourseStats } from "@/lib/analytics/course-stats";

export default async function LearnCoursePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: course }, { data: lessons }, { data: progress }, { data: capstone }, { data: allEnrollments }, { data: allProgress }, { data: profile }] = await Promise.all([
    admin.from("courses").select("*").eq("id", params.id).eq("published", true).single(),
    admin.from("lessons").select("id, title, order, what_you_learn, skills, duration_seconds").eq("course_id", params.id).order("order"),
    admin.from("progress").select("lesson_id").eq("user_id", user!.id),
    admin.from("capstones").select("id").eq("course_id", params.id).single(),
    admin.from("enrollments").select("user_id").eq("course_id", params.id),
    // progress has no course_id — it is per-lesson. Scope to this course by
    // inner-joining lessons, otherwise the query errors and the cohort average
    // silently reads as 0%.
    admin
      .from("progress")
      .select("user_id, lesson_id, lessons!inner(course_id)")
      .eq("lessons.course_id", params.id),
    admin.from("profiles").select("full_name").eq("id", user!.id).single(),
  ]);

  if (!course) notFound();

  // Process any pending invitations for this course before checking enrollment
  const userEmail = user!.email?.toLowerCase();
  if (userEmail) {
    const { data: pendingInvites } = await admin
      .from("invitations")
      .select("id, course_id")
      .eq("email", userEmail)
      .eq("course_id", params.id)
      .eq("status", "pending");
    if (pendingInvites && pendingInvites.length > 0) {
      await Promise.all(
        pendingInvites.map((inv) =>
          Promise.all([
            admin.from("enrollments").upsert(
              { user_id: user!.id, course_id: inv.course_id },
              { onConflict: "user_id,course_id" }
            ),
            admin.from("invitations").update({ status: "accepted" }).eq("id", inv.id),
          ])
        )
      );
    }
  }

  // Check enrollment — auto-enroll if user already has progress (migration compat)
  const { data: enrollment } = await admin
    .from("enrollments")
    .select("id")
    .eq("user_id", user!.id)
    .eq("course_id", params.id)
    .single();

  if (!enrollment) {
    const hasProgress = (progress ?? []).some((p) =>
      (lessons ?? []).some((l) => l.id === p.lesson_id)
    );
    if (hasProgress) {
      await admin.from("enrollments").upsert(
        { user_id: user!.id, course_id: params.id },
        { onConflict: "user_id,course_id" }
      );
    } else {
      const isPrivate = course?.access_type === "private" || course?.course_type === "internal";
      redirect(isPrivate ? "/learn" : `/courses/${params.id}`);
    }
  }

  const completedIds = new Set((progress ?? []).map((p) => p.lesson_id));
  const total = lessons?.length ?? 0;
  const completed = lessons?.filter((l) => completedIds.has(l.id)).length ?? 0;
  const outcomes: string[] = course.outcomes ?? [];

  // Cohort average progress
  const lessonIds = new Set((lessons ?? []).map((l) => l.id));
  const cohortEnrolled = (allEnrollments ?? []).filter((e) => e.user_id !== user!.id);
  const cohortAvgPct = (() => {
    if (cohortEnrolled.length === 0 || total === 0) return null;
    const cohortUserIds = new Set(cohortEnrolled.map((e) => e.user_id));
    const progressPerUser: Record<string, number> = {};
    for (const p of allProgress ?? []) {
      if (cohortUserIds.has(p.user_id) && lessonIds.has(p.lesson_id)) {
        progressPerUser[p.user_id] = (progressPerUser[p.user_id] ?? 0) + 1;
      }
    }
    const totals = Object.values(progressPerUser);
    if (totals.length === 0) return 0;
    const avg = totals.reduce((s, c) => s + c, 0) / cohortEnrolled.length;
    return Math.round((avg / total) * 100);
  })();

  // Learner analytics. Aggregated in Postgres via RPC — returns null if that
  // migration has not been applied yet, in which case the panel simply hides.
  const courseStats = await getCourseStats(admin, params.id, user!.id);
  // Column may not exist until learner_analytics.sql is applied; `select("*")`
  // above tolerates that, so read it defensively and default to showing.
  const showCohort = (course as any)?.show_cohort_comparison ?? true;

  // Next up: first incomplete lesson
  const nextLesson = (lessons ?? []).find((l) => !completedIds.has(l.id)) ?? null;
  const firstName = profile?.full_name?.split(" ")[0]?.trim() ?? "";
  const aiCoachEnabled = (course as any)?.ai_coach_enabled ?? true;
  const coachLessonId = nextLesson?.id ?? lessons?.[0]?.id ?? null;

  const displayHours = (() => {
    if (course.hours_to_complete) return `${course.hours_to_complete} hr`;
    const totalSeconds = (lessons ?? []).reduce((sum, l) => sum + (l.duration_seconds ?? 0), 0);
    if (!totalSeconds) return null;
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.round((totalSeconds % 3600) / 60);
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h} hr`;
    return `${h} hr ${m} min`;
  })();

  // Fetch lesson files and course resources (after confirming enrollment)
  const lessonIdArray = (lessons ?? []).map((l) => l.id);
  const [{ data: allLessonFiles }, { data: courseResources }] = await Promise.all([
    lessonIdArray.length > 0
      ? admin
          .from("lesson_files")
          .select("id, lesson_id, file_name, storage_path")
          .in("lesson_id", lessonIdArray)
      : Promise.resolve({ data: [] as { id: string; lesson_id: string; file_name: string; storage_path: string }[] }),
    admin
      .from("course_resources")
      .select("id, title, url, storage_path, file_name, description")
      .eq("course_id", params.id)
      .order("created_at"),
  ]);

  // Build lesson files map with signed URLs
  const lessonFilesMap: Record<string, { id: string; file_name: string; url: string }[]> = {};
  if (allLessonFiles && allLessonFiles.length > 0) {
    await Promise.all(
      allLessonFiles.map(async (f) => {
        const { data } = await admin.storage
          .from("lesson-files")
          .createSignedUrl(f.storage_path, 3600);
        const url = data?.signedUrl ?? "#";
        if (!lessonFilesMap[f.lesson_id]) lessonFilesMap[f.lesson_id] = [];
        lessonFilesMap[f.lesson_id].push({ id: f.id, file_name: f.file_name, url });
      })
    );
  }

  // Build course resources list, generating signed URLs for storage-backed files
  const processedResources = await Promise.all(
    (courseResources ?? []).map(async (r) => {
      let url = r.url ?? null;
      if (!url && r.storage_path) {
        const { data } = await admin.storage
          .from("course-resources")
          .createSignedUrl(r.storage_path, 3600);
        url = data?.signedUrl ?? null;
      }
      return {
        id: r.id,
        title: r.title,
        url,
        file_name: r.file_name ?? null,
        description: (r as any).description ?? null,
      };
    })
  );

  return (
    <>
    <div className="max-w-2xl">
      <Link href="/learn" className="text-sm text-gray-500 hover:text-gray-700">← My Courses</Link>

      <h1 className="text-2xl font-bold mt-2 mb-1">{course.title}</h1>

      {/* Meta */}
      <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-3">
        {total > 0 && (
          <span className="flex items-center gap-1.5">
            <span>📚</span> {total} module{total !== 1 ? "s" : ""}
          </span>
        )}
        {displayHours && (
          <span className="flex items-center gap-1.5">
            <span>⏱</span> {displayHours} to complete
          </span>
        )}
      </div>

      {course.description && (
        <p className="text-gray-500 mb-5 leading-relaxed">{course.description}</p>
      )}

      {/* Next Up widget */}
      {nextLesson && completed < total && (
        <Link
          href={`/learn/courses/${course.id}/lessons/${nextLesson.id}`}
          className="block bg-brand-600 text-white rounded-xl px-5 py-4 mb-5 hover:bg-brand-700 transition-colors"
        >
          <p className="text-xs font-medium opacity-75 mb-1 uppercase tracking-wide">Next up</p>
          <p className="font-semibold text-base">{nextLesson.title}</p>
          <p className="text-xs opacity-75 mt-1">Continue where you left off →</p>
        </Link>
      )}
      {completed === total && total > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 mb-5 text-green-800">
          <p className="font-semibold">All modules complete!</p>
          {capstone && <p className="text-sm mt-0.5">Head to the Capstone project to finish the course.</p>}
        </div>
      )}

      {/* Progress bar */}
      {total > 0 && (
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-500 mb-1">
            <span>{completed} of {total} modules completed</span>
            <span className="font-medium">{Math.round((completed / total) * 100)}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full mb-1.5">
            <div
              className="h-2 bg-brand-600 rounded-full transition-all"
              style={{ width: `${(completed / total) * 100}%` }}
            />
          </div>
          {/* Fallback only. The analytics panel below carries this comparison in a
              richer form, but it needs the course_learner_stats RPC — so until
              learner_analytics.sql is applied, keep the original line rather than
              silently dropping the cohort average from every learner's page. */}
          {!courseStats && showCohort && cohortAvgPct !== null && (
            <p className="text-xs text-gray-400">
              Cohort average: {cohortAvgPct}%
              {completed > 0 && Math.round((completed / total) * 100) >= cohortAvgPct
                ? <span className="text-green-600 ml-1">· You&apos;re ahead</span>
                : completed > 0 ? <span className="text-amber-500 ml-1">· Keep going</span> : null}
            </p>
          )}
        </div>
      )}

      {/* Learner analytics. Supersedes the fallback line above once the RPC exists;
          honours the course's show_cohort_comparison setting. */}
      {courseStats && (
        <AnalyticsPanel stats={courseStats} totalLessons={total} showCohort={showCohort} />
      )}

      {/* Action buttons */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href={`/learn/courses/${course.id}/discussions`}
          className="inline-flex items-center gap-2 text-sm border rounded-lg px-4 py-2 hover:bg-gray-50 text-gray-600"
        >
          <span>💬</span> Discussions
        </Link>
        <Link
          href={`/learn/courses/${course.id}/feedback`}
          className="inline-flex items-center gap-2 text-sm border rounded-lg px-4 py-2 hover:bg-gray-50 text-gray-600"
        >
          <span>📋</span> My grades
        </Link>
        <Link
          href={`/learn/courses/${course.id}/journal`}
          className="inline-flex items-center gap-2 text-sm border rounded-lg px-4 py-2 hover:bg-gray-50 text-gray-600"
        >
          <span>📓</span> My journal
        </Link>
        {course.timetable_enabled && (
          <Link
            href={`/learn/courses/${course.id}/timetable`}
            className="inline-flex items-center gap-2 text-sm border rounded-lg px-4 py-2 hover:bg-gray-50 text-gray-600"
          >
            <span>📅</span> Schedule
          </Link>
        )}
        {capstone && (
          <Link
            href={`/learn/courses/${course.id}/capstone`}
            className="inline-flex items-center gap-2 text-sm border border-purple-300 text-purple-600 rounded-lg px-4 py-2 hover:bg-purple-50"
          >
            <span>🎓</span> Capstone project
          </Link>
        )}
      </div>

      {/* Outcomes */}
      {outcomes.length > 0 && (
        <div className="bg-white border rounded-xl p-5 mb-5">
          <h2 className="font-semibold text-gray-900 mb-3">What you&apos;ll achieve</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {outcomes.map((outcome, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-green-500 font-bold text-sm mt-0.5 shrink-0">✓</span>
                <span className="text-sm text-gray-700">{outcome}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modules */}
      {lessons && lessons.length > 0 && (
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b">
            <h2 className="font-semibold text-gray-900">Course modules</h2>
          </div>
          <ModuleAccordion
            lessons={lessons}
            courseId={course.id}
            completedIds={completedIds}
            nextLessonId={nextLesson?.id ?? null}
            cohortAvgPct={showCohort ? cohortAvgPct : null}
            lessonFiles={lessonFilesMap}
            courseResources={processedResources}
            allowShuffled={course.allow_shuffled_learning ?? false}
          />
        </div>
      )}
    </div>

    {aiCoachEnabled && coachLessonId && (
      <AiCoach
        lessonId={coachLessonId}
        courseId={params.id}
        userId={user!.id}
        firstName={firstName}
      />
    )}
    </>
  );
}
