import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { getModeratorCohort } from "@/lib/get-moderator-cohort";
import { QuizAnalysisSection } from "../quiz-analysis";
import type { QuizStat, AtRiskLearner } from "../quiz-analysis";

export const dynamic = "force-dynamic";

const AT_RISK_SCORE_THRESHOLD = 60;
const AT_RISK_COUNT_THRESHOLD = 2;

// Analytics → Quizzes: per-quiz completion & cohort average, per-question success
// rates + distractors, and at-risk learners (by failed-quiz count).
export default async function QuizzesPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return notFound();

  const accessErr = await assertCourseOwner(params.id, user.id);
  if (accessErr) return accessErr;

  const { data: viewerProfile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  const cohortIds = await getModeratorCohort(user.id, params.id, viewerProfile?.role ?? "");
  const isCohortLimited = cohortIds !== null;

  const { data: course } = await admin.from("courses").select("id, title").eq("id", params.id).single();
  if (!course) notFound();

  const { data: lessons } = await admin
    .from("lessons")
    .select("id, title, order")
    .eq("course_id", params.id)
    .order("order");
  const lessonIds = (lessons ?? []).map((l) => l.id);

  const [{ data: allEnrollments }, { data: quizzes }] = await Promise.all([
    admin.from("enrollments").select("user_id").eq("course_id", params.id),
    lessonIds.length > 0
      ? admin.from("quizzes").select("id, lesson_id, questions").in("lesson_id", lessonIds)
      : Promise.resolve({ data: [] }),
  ]);

  const enrollments = cohortIds !== null
    ? (allEnrollments ?? []).filter((e) => cohortIds.includes(e.user_id))
    : (allEnrollments ?? []);
  const userIds = enrollments.map((e) => e.user_id);
  const quizIds = (quizzes ?? []).map((q) => q.id);

  const [{ data: profiles }, { data: quizResponses }] = await Promise.all([
    userIds.length > 0
      ? admin.from("profiles").select("id, full_name, email").in("id", userIds)
      : Promise.resolve({ data: [] }),
    quizIds.length > 0
      ? admin.from("quiz_responses").select("quiz_id, user_id, answers, score").in("quiz_id", quizIds).in("user_id", userIds)
      : Promise.resolve({ data: [] }),
  ]);

  type QuizQuestion = { question: string; options: string[]; correct: number };
  const quizMap = Object.fromEntries(
    (quizzes ?? []).map((q) => [q.id, { lesson_id: q.lesson_id, questions: (q.questions ?? []) as QuizQuestion[] }])
  );
  const lessonMap = Object.fromEntries((lessons ?? []).map((l) => [l.id, l]));
  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

  const responsesByQuiz: Record<string, Array<{ user_id: string; answers: number[]; score: number | null }>> = {};
  for (const r of quizResponses ?? []) {
    if (!responsesByQuiz[r.quiz_id]) responsesByQuiz[r.quiz_id] = [];
    responsesByQuiz[r.quiz_id].push({
      user_id: r.user_id,
      answers: r.answers as number[],
      score: typeof r.score === "number" ? r.score : null,
    });
  }

  const cohortSize = userIds.length;

  // At-risk learners (failed >= 2 quizzes below 60%)
  const userQuizScores: Record<string, { lessonTitle: string; score: number }[]> = {};
  for (const r of quizResponses ?? []) {
    if (typeof r.score !== "number") continue;
    if (!userQuizScores[r.user_id]) userQuizScores[r.user_id] = [];
    const lesson = lessonMap[quizMap[r.quiz_id]?.lesson_id];
    userQuizScores[r.user_id].push({ lessonTitle: lesson?.title ?? "Quiz", score: r.score });
  }

  const atRiskLearners: AtRiskLearner[] = userIds
    .map((uid) => {
      const scores = userQuizScores[uid] ?? [];
      const failed = scores.filter((s) => s.score < AT_RISK_SCORE_THRESHOLD);
      if (failed.length < AT_RISK_COUNT_THRESHOLD) return null;
      const uniqueModules = Array.from(new Set(failed.map((f) => f.lessonTitle)));
      return {
        name: profileMap[uid]?.full_name ?? profileMap[uid]?.email ?? uid,
        failedQuizCount: failed.length,
        weakModules: uniqueModules.slice(0, 3).join(", "),
      } as AtRiskLearner;
    })
    .filter((x): x is AtRiskLearner => x !== null)
    .sort((a, b) => b.failedQuizCount - a.failedQuizCount);

  const orderedQuizzes = (quizzes ?? []).slice().sort((a, b) => {
    const la = lessonMap[a.lesson_id]?.order ?? 0;
    const lb = lessonMap[b.lesson_id]?.order ?? 0;
    return la - lb;
  });

  const quizStats: QuizStat[] = orderedQuizzes.map((q) => {
    const qs = quizMap[q.id].questions;
    const responses = responsesByQuiz[q.id] ?? [];
    const lesson = lessonMap[q.lesson_id];

    const uniqueAttemptors = Array.from(new Set(responses.map((r) => r.user_id))).length;
    const completionPct = cohortSize > 0 ? Math.round((uniqueAttemptors / cohortSize) * 100) : 0;

    const scores = responses.map((r) => r.score).filter((s): s is number => s !== null);
    const cohortAvgScore = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null;

    const questions = qs.map((question: QuizQuestion, i: number) => {
      const correctCount = responses.filter((r) => r.answers?.[i] === question.correct).length;
      const successPct = responses.length > 0 ? Math.round((correctCount / responses.length) * 100) : null;

      const optionCounts: number[] = (question.options ?? []).map(() => 0);
      for (const r of responses) {
        const chosen = r.answers?.[i];
        if (typeof chosen === "number" && chosen >= 0 && chosen < optionCounts.length) optionCounts[chosen]++;
      }
      const distractors = (question.options ?? []).map((text: string, oi: number) => ({
        text,
        count: optionCounts[oi],
        isCorrect: oi === question.correct,
      }));

      return { text: question.question, successPct, totalResponses: responses.length, distractors };
    });

    return {
      quizId: q.id,
      lessonOrder: lesson?.order ?? 0,
      lessonTitle: lesson?.title ?? "Quiz",
      uniqueAttemptors,
      cohortSize,
      completionPct,
      cohortAvgScore,
      questions,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">Quizzes</h2>
        <p className="text-sm text-gray-500">
          Completion, scores, and per-question analysis for {course.title}.
          {isCohortLimited && (
            <span className="ml-2 text-blue-600 font-medium">Showing your cohort ({cohortIds!.length} learners).</span>
          )}
        </p>
      </div>

      <QuizAnalysisSection
        courseId={params.id}
        courseTitle={course.title}
        quizStats={quizStats}
        atRiskLearners={atRiskLearners}
        isCohortLimited={isCohortLimited}
      />
    </div>
  );
}
