import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { CohortDashboard, type CohortLearner } from "./cohort-dashboard";

export const dynamic = "force-dynamic";

export default async function CohortPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();

  // Admins and creators can see a cohort view too — they see all learners across all their courses
  // course_managers see only their assigned cohort
  const role = profile?.role ?? "";
  if (!["admin", "course_creator", "course_manager"].includes(role)) redirect("/learn");

  // Step 1: Get all courses this user has access to + their cohort assignments
  let courseIds: string[] = [];

  if (role === "course_manager") {
    // Get all courses where they have cohort assignments
    const { data: assignments } = await admin
      .from("moderator_cohort_assignments")
      .select("course_id")
      .eq("moderator_id", user.id);
    courseIds = Array.from(new Set((assignments ?? []).map((a) => a.course_id)));
  } else if (role === "course_creator") {
    const { data: courses } = await admin
      .from("courses")
      .select("id")
      .eq("created_by", user.id);
    courseIds = (courses ?? []).map((c) => c.id);
  } else {
    // admin — all courses
    const { data: courses } = await admin.from("courses").select("id");
    courseIds = (courses ?? []).map((c) => c.id);
  }

  if (courseIds.length === 0) {
    return (
      <CohortDashboard
        learners={[]}
        courses={[]}
      />
    );
  }

  // Step 2: Get course details and all lessons
  const [{ data: courses }, { data: allLessons }] = await Promise.all([
    admin.from("courses").select("id, title").in("id", courseIds),
    admin.from("lessons").select("id, course_id").in("course_id", courseIds),
  ]);

  // Step 3: Get cohort learner IDs per course
  let learnerPerCourse: { course_id: string; learner_id: string }[] = [];

  if (role === "course_manager") {
    const { data: assignments } = await admin
      .from("moderator_cohort_assignments")
      .select("course_id, learner_id")
      .eq("moderator_id", user.id);
    learnerPerCourse = assignments ?? [];
  } else {
    // For admin/creator: all enrolled learners
    const { data: enrollments } = await admin
      .from("enrollments")
      .select("course_id, user_id")
      .in("course_id", courseIds);
    learnerPerCourse = (enrollments ?? []).map((e) => ({
      course_id: e.course_id,
      learner_id: e.user_id,
    }));
  }

  if (learnerPerCourse.length === 0) {
    return (
      <CohortDashboard
        learners={[]}
        courses={(courses ?? []).map((c) => ({ id: c.id, title: c.title }))}
      />
    );
  }

  const allLearnerIds = Array.from(new Set(learnerPerCourse.map((r) => r.learner_id)));
  const allLessonIds = (allLessons ?? []).map((l) => l.id);

  // Step 4: Fetch all profile/progress/quiz/assignment data in parallel
  const [
    { data: profiles },
    { data: progressRows },
    { data: quizzes },
    { data: quizResponses },
    { data: assignments },
    { data: submissions },
  ] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, email, salesforce_url")
      .in("id", allLearnerIds),
    allLearnerIds.length > 0 && allLessonIds.length > 0
      ? admin.from("progress").select("user_id, lesson_id").in("user_id", allLearnerIds).in("lesson_id", allLessonIds)
      : Promise.resolve({ data: [] }),
    allLessonIds.length > 0
      ? admin.from("quizzes").select("id, lesson_id").in("lesson_id", allLessonIds)
      : Promise.resolve({ data: [] }),
    allLearnerIds.length > 0
      ? admin.from("quiz_responses").select("user_id, quiz_id, score").in("user_id", allLearnerIds).order("submitted_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    allLessonIds.length > 0
      ? admin.from("assignments").select("id, lesson_id").in("lesson_id", allLessonIds)
      : Promise.resolve({ data: [] }),
    allLearnerIds.length > 0
      ? admin.from("submissions").select("user_id, assignment_id, status").in("user_id", allLearnerIds)
      : Promise.resolve({ data: [] }),
  ]);

  // Build lookup maps
  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
  const lessonsByCourse = Object.fromEntries(
    courseIds.map((cid) => [cid, (allLessons ?? []).filter((l) => l.course_id === cid).map((l) => l.id)])
  );

  // Quiz: lessonId → quizId
  const quizByLesson = Object.fromEntries((quizzes ?? []).map((q) => [q.lesson_id, q.id]));

  // Quiz responses: userId → quizId → latest score
  const latestQuizScore: Record<string, Record<string, number>> = {};
  for (const r of quizResponses ?? []) {
    if (!latestQuizScore[r.user_id]) latestQuizScore[r.user_id] = {};
    // quizResponses are ordered desc by submitted_at — first seen = latest
    if (latestQuizScore[r.user_id][r.quiz_id] === undefined) {
      latestQuizScore[r.user_id][r.quiz_id] = r.score ?? 0;
    }
  }

  // Assignments: lessonId → assignmentId
  const assignmentByLesson = Object.fromEntries((assignments ?? []).map((a) => [a.lesson_id, a.id]));

  // Submissions: userId → assignmentId → status
  const submissionsByUser: Record<string, Set<string>> = {};
  for (const s of submissions ?? []) {
    if (!submissionsByUser[s.user_id]) submissionsByUser[s.user_id] = new Set();
    submissionsByUser[s.user_id].add(s.assignment_id);
  }

  // Progress: userId → Set<lessonId>
  const progressByUser: Record<string, Set<string>> = {};
  for (const p of progressRows ?? []) {
    if (!progressByUser[p.user_id]) progressByUser[p.user_id] = new Set();
    progressByUser[p.user_id].add(p.lesson_id);
  }

  // Build learner rows (one per learner-course pair)
  const learners: CohortLearner[] = learnerPerCourse.map(({ course_id, learner_id }) => {
    const profile = profileMap[learner_id];
    const courseLessons = lessonsByCourse[course_id] ?? [];
    const completedIds = progressByUser[learner_id] ?? new Set();
    const completedCount = courseLessons.filter((lid) => completedIds.has(lid)).length;
    const totalLessons = courseLessons.length;
    const pct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

    // Quiz avg: average of latest scores for quizzes in this course
    const quizIds = courseLessons.map((lid) => quizByLesson[lid]).filter(Boolean);
    const userQuizScores = quizIds
      .map((qid) => latestQuizScore[learner_id]?.[qid])
      .filter((s) => s !== undefined) as number[];
    const avgQuiz =
      userQuizScores.length > 0
        ? Math.round(userQuizScores.reduce((a, b) => a + b, 0) / userQuizScores.length)
        : null;

    // Assignments: count submitted vs total for this course
    const assignmentIds = courseLessons.map((lid) => assignmentByLesson[lid]).filter(Boolean);
    const totalAssignments = assignmentIds.length;
    const userSubmissions = submissionsByUser[learner_id] ?? new Set();
    const submittedCount = assignmentIds.filter((aid) => userSubmissions.has(aid)).length;

    const courseTitle = (courses ?? []).find((c) => c.id === course_id)?.title ?? "Unknown course";

    return {
      userId: learner_id,
      name: profile?.full_name || profile?.email || "Unknown",
      email: profile?.email ?? "",
      salesforce_url: (profile as any)?.salesforce_url ?? null,
      courseId: course_id,
      courseTitle,
      pct,
      completedCount,
      totalLessons,
      avgQuiz,
      submittedCount,
      totalAssignments,
    };
  });

  const courseList = (courses ?? []).map((c) => ({ id: c.id, title: c.title }));

  return <CohortDashboard learners={learners} courses={courseList} />;
}
