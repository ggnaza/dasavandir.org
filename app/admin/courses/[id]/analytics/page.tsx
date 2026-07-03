import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { getModeratorCohort } from "@/lib/get-moderator-cohort";
import { clampSessionSeconds } from "@/lib/session-time";
import { AnalyticsTabs } from "./analytics-tabs";
import { QuizAnalysisSection } from "./quiz-analysis";
import type { QuizStat, AtRiskLearner } from "./quiz-analysis";

export const dynamic = "force-dynamic";

function HeatCell({ pct }: { pct: number }) {
  const bg =
    pct >= 80 ? "bg-green-500" :
    pct >= 60 ? "bg-green-300" :
    pct >= 40 ? "bg-amber-300" :
    pct >= 20 ? "bg-red-300" : "bg-red-500";
  return (
    <div className={`flex items-center justify-center rounded text-white text-xs font-bold ${bg}`} style={{ minWidth: 44, height: 32 }}>
      {pct}%
    </div>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatTime(seconds: number): string {
  if (seconds === 0) return "—";
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

const AT_RISK_SCORE_THRESHOLD = 60;
const AT_RISK_COUNT_THRESHOLD = 2;

export default async function AnalyticsPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return notFound();

  const accessErr = await assertCourseOwner(params.id, user.id);
  if (accessErr) return accessErr;

  const { data: viewerProfile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  const cohortIds = await getModeratorCohort(user.id, params.id, viewerProfile?.role ?? "");
  const isCohortLimited = cohortIds !== null && cohortIds.length > 0;

  const { data: course } = await admin.from("courses").select("id, title").eq("id", params.id).single();
  if (!course) notFound();

  const { data: lessons } = await admin
    .from("lessons")
    .select("id, title, order")
    .eq("course_id", params.id)
    .order("order");

  const lessonIds = (lessons ?? []).map((l) => l.id);

  const [{ data: allEnrollments }, { data: quizzes }, { data: aiMemory }, { data: lastSessions }, { data: coachSessions }] = await Promise.all([
    admin.from("enrollments").select("user_id").eq("course_id", params.id),
    lessonIds.length > 0
      ? admin.from("quizzes").select("id, lesson_id, questions").in("lesson_id", lessonIds)
      : Promise.resolve({ data: [] }),
    admin.from("ai_coach_memory").select("user_id, updated_at").eq("course_id", params.id),
    lessonIds.length > 0
      ? admin.from("lesson_sessions").select("user_id, duration_seconds, created_at").in("lesson_id", lessonIds)
      : Promise.resolve({ data: [] }),
    admin.from("ai_coach_sessions").select("user_id, lesson_id, started_at, last_message_at, message_count").eq("course_id", params.id),
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

  // ── Assessment Heatmap ──
  type QuizQuestion = { question: string; options: string[]; correct: number };
  const quizMap = Object.fromEntries(
    (quizzes ?? []).map((q) => [q.id, { lesson_id: q.lesson_id, questions: (q.questions ?? []) as QuizQuestion[] }])
  );
  const lessonMap = Object.fromEntries((lessons ?? []).map((l) => [l.id, l]));

  // Group responses by quiz_id
  const responsesByQuiz: Record<string, Array<{ user_id: string; answers: number[]; score: number | null }>> = {};
  for (const r of quizResponses ?? []) {
    if (!responsesByQuiz[r.quiz_id]) responsesByQuiz[r.quiz_id] = [];
    responsesByQuiz[r.quiz_id].push({
      user_id: r.user_id,
      answers: r.answers as number[],
      score: typeof r.score === "number" ? r.score : null,
    });
  }

  // Per-quiz, per-question success rate (existing heatmap)
  const heatmapData = (quizzes ?? []).map((q) => {
    const qs = quizMap[q.id].questions;
    const responses = responsesByQuiz[q.id] ?? [];
    const lesson = lessonMap[q.lesson_id];
    const questionStats = qs.map((question: QuizQuestion, i: number) => {
      const correct = responses.filter((r) => r.answers?.[i] === question.correct).length;
      const pct = responses.length > 0 ? Math.round((correct / responses.length) * 100) : null;
      return { question: question.question, pct, attempts: responses.length };
    });
    return { lesson, questionStats, totalAttempts: responses.length };
  }).filter((d) => d.questionStats.length > 0);

  // ── Quiz Analysis (new tab) ──────────────────────────────────────────────
  const cohortSize = userIds.length;

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

  // Build per-user, per-quiz score map for at-risk detection
  const userQuizScores: Record<string, { quizId: string; lessonTitle: string; score: number }[]> = {};
  for (const r of quizResponses ?? []) {
    if (!userQuizScores[r.user_id]) userQuizScores[r.user_id] = [];
    if (typeof r.score === "number") {
      const lesson = lessonMap[quizMap[r.quiz_id]?.lesson_id];
      userQuizScores[r.user_id].push({
        quizId: r.quiz_id,
        lessonTitle: lesson?.title ?? "Quiz",
        score: r.score,
      });
    }
  }

  // At-risk learners
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

  // Build QuizStat[] — one per quiz, ordered by lesson order
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
      const successPct = responses.length > 0
        ? Math.round((correctCount / responses.length) * 100)
        : null;

      // Count how many chose each option
      const optionCounts: number[] = (question.options ?? []).map(() => 0);
      for (const r of responses) {
        const chosen = r.answers?.[i];
        if (typeof chosen === "number" && chosen >= 0 && chosen < optionCounts.length) {
          optionCounts[chosen]++;
        }
      }

      const distractors = (question.options ?? []).map((text: string, oi: number) => ({
        text,
        count: optionCounts[oi],
        isCorrect: oi === question.correct,
      }));

      return {
        text: question.question,
        successPct,
        totalResponses: responses.length,
        distractors,
      };
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

  // ── AI Coach Session Aggregation ──
  const aiMemoryMap = Object.fromEntries(
    (aiMemory ?? []).map((m) => [m.user_id, m.updated_at])
  );

  type CoachStats = {
    sessions: number;
    messages: number;
    durationSeconds: number;
    lastActive: string | null;
    lessonIds: Set<string>;
  };
  const coachStatsMap: Record<string, CoachStats> = {};
  for (const s of coachSessions ?? []) {
    if (!coachStatsMap[s.user_id]) {
      coachStatsMap[s.user_id] = { sessions: 0, messages: 0, durationSeconds: 0, lastActive: null, lessonIds: new Set() };
    }
    const stats = coachStatsMap[s.user_id];
    stats.sessions += 1;
    stats.messages += s.message_count ?? 0;
    if (s.started_at && s.last_message_at) {
      stats.durationSeconds += Math.max(0, Math.round(
        (new Date(s.last_message_at).getTime() - new Date(s.started_at).getTime()) / 1000
      ));
    }
    if (!stats.lastActive || (s.last_message_at && s.last_message_at > stats.lastActive)) {
      stats.lastActive = s.last_message_at;
    }
    if (s.lesson_id) stats.lessonIds.add(s.lesson_id);
  }

  function engagementLevel(stats: CoachStats | undefined): "none" | "low" | "medium" | "high" {
    if (!stats || stats.sessions === 0) return "none";
    if (stats.sessions >= 6 || stats.messages >= 26) return "high";
    if (stats.sessions >= 3 || stats.messages >= 10) return "medium";
    return "low";
  }

  const engagementBadge = {
    none:   { label: "None",   cls: "bg-gray-100 text-gray-400" },
    low:    { label: "Low",    cls: "bg-yellow-100 text-yellow-700" },
    medium: { label: "Medium", cls: "bg-blue-100 text-blue-700" },
    high:   { label: "High",   cls: "bg-green-100 text-green-700" },
  };

  // ── System Access Logs ──
  const lastActivityMap: Record<string, string | null> = {};
  const totalTimeMap: Record<string, number> = {};
  for (const s of lastSessions ?? []) {
    if (!lastActivityMap[s.user_id] || s.created_at > (lastActivityMap[s.user_id] ?? "")) {
      lastActivityMap[s.user_id] = s.created_at;
    }
    totalTimeMap[s.user_id] = (totalTimeMap[s.user_id] ?? 0) + clampSessionSeconds(s.duration_seconds);
  }

  const learnerAccessRows = userIds.map((uid) => ({
    uid,
    name: profileMap[uid]?.full_name ?? profileMap[uid]?.email ?? uid,
    lastActivity: lastActivityMap[uid] ?? null,
    totalTime: totalTimeMap[uid] ?? 0,
    usedAiCoach: !!aiMemoryMap[uid],
    aiCoachLastUsed: aiMemoryMap[uid] ?? null,
  })).sort((a, b) => {
    if (!a.lastActivity && !b.lastActivity) return 0;
    if (!a.lastActivity) return 1;
    if (!b.lastActivity) return -1;
    return b.lastActivity.localeCompare(a.lastActivity);
  });

  // ── Render ───────────────────────────────────────────────────────────────

  const overviewContent = (
    <div className="space-y-10">
      {/* ── Assessment Heatmap ── */}
      <section>
        <h3 className="text-base font-semibold mb-1">Assessment Item Analysis</h3>
        <p className="text-xs text-gray-400 mb-4">
          Per-question success rate across all learners.
          <span className="ml-2 inline-flex gap-2 items-center">
            <span className="inline-block w-3 h-3 rounded bg-green-500" /> ≥80%
            <span className="inline-block w-3 h-3 rounded bg-amber-300" /> 40–79%
            <span className="inline-block w-3 h-3 rounded bg-red-400" /> &lt;40%
          </span>
        </p>

        {heatmapData.length === 0 ? (
          <div className="bg-white border rounded-xl p-8 text-center text-gray-400 text-sm">
            No quiz responses yet.
          </div>
        ) : (
          <div className="space-y-6">
            {heatmapData.map((d, qi) => (
              <div key={qi} className="bg-white border rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-800">
                    Module {d.lesson?.order}: {d.lesson?.title}
                  </span>
                  <span className="text-xs text-gray-400">{d.totalAttempts} attempt{d.totalAttempts !== 1 ? "s" : ""}</span>
                </div>
                <div className="px-5 py-4 space-y-3">
                  {d.questionStats.map((qs: { question: string; pct: number | null; attempts: number }, i: number) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-5 shrink-0 text-right">Q{i + 1}</span>
                      <span className="text-sm text-gray-700 flex-1 min-w-0 truncate" title={qs.question}>{qs.question}</span>
                      {qs.pct !== null ? (
                        <HeatCell pct={qs.pct} />
                      ) : (
                        <div className="flex items-center justify-center bg-gray-100 text-gray-400 text-xs rounded" style={{ minWidth: 44, height: 32 }}>—</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── AI Coach Engagement ── */}
      <section>
        <h3 className="text-base font-semibold mb-1">AI Coach Engagement</h3>
        <p className="text-xs text-gray-400 mb-4">
          Session frequency and interaction depth per learner. Chat transcripts are never stored or displayed here — only aggregate usage data.
        </p>

        {learnerAccessRows.length > 0 && (() => {
          const activeUsers = userIds.filter((uid) => (coachStatsMap[uid]?.sessions ?? 0) > 0);
          const totalSessions = Object.values(coachStatsMap).reduce((s, c) => s + c.sessions, 0);
          const totalMessages = Object.values(coachStatsMap).reduce((s, c) => s + c.messages, 0);
          const highEngagement = userIds.filter((uid) => engagementLevel(coachStatsMap[uid]) === "high").length;
          return (
            <div className="grid grid-cols-4 gap-3 mb-5">
              <div className="bg-white border rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500">Active users</p>
                <p className="text-2xl font-bold mt-1">{activeUsers.length}<span className="text-sm text-gray-400 font-normal">/{userIds.length}</span></p>
              </div>
              <div className="bg-white border rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500">Total sessions</p>
                <p className="text-2xl font-bold mt-1">{totalSessions}</p>
              </div>
              <div className="bg-white border rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500">Total messages</p>
                <p className="text-2xl font-bold mt-1">{totalMessages}</p>
              </div>
              <div className="bg-white border rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500">High engagement</p>
                <p className="text-2xl font-bold mt-1 text-green-600">{highEngagement}</p>
                <p className="text-xs text-gray-400">≥6 sessions or 26+ msgs</p>
              </div>
            </div>
          );
        })()}

        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50 grid grid-cols-12 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <span className="col-span-3">Learner</span>
            <span className="col-span-2 text-center">Engagement</span>
            <span className="col-span-1 text-right">Sessions</span>
            <span className="col-span-1 text-right">Messages</span>
            <span className="col-span-2 text-right">Lessons used</span>
            <span className="col-span-1 text-right">Time</span>
            <span className="col-span-2 text-right">Last active</span>
          </div>

          {learnerAccessRows.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-400 text-center">No learners enrolled.</p>
          ) : (
            <div className="divide-y">
              {learnerAccessRows.map((r) => {
                const stats = coachStatsMap[r.uid];
                const level = engagementLevel(stats);
                const badge = engagementBadge[level];
                const avgPerSession = stats && stats.sessions > 0
                  ? (stats.messages / stats.sessions).toFixed(1)
                  : null;
                return (
                  <div key={r.uid} className="px-5 py-3 grid grid-cols-12 items-start text-sm">
                    <span className="col-span-3 font-medium text-gray-800 truncate pt-0.5">{r.name}</span>
                    <span className="col-span-2 text-center pt-0.5">
                      <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>
                        {level === "high" && "✦ "}{badge.label}
                      </span>
                    </span>
                    <span className="col-span-1 text-right text-xs text-gray-600 tabular-nums pt-0.5">
                      {stats?.sessions ?? 0}
                    </span>
                    <span className="col-span-1 text-right text-xs text-gray-600 tabular-nums pt-0.5">
                      {stats?.messages ?? 0}
                    </span>
                    <span className="col-span-2 text-right text-xs text-gray-500">
                      {stats && stats.lessonIds.size > 0
                        ? Array.from(stats.lessonIds).map((lid) => (
                            <span key={lid} className="block truncate" title={lessonMap[lid]?.title}>
                              {lessonMap[lid] ? `M${lessonMap[lid].order}` : "—"}
                            </span>
                          ))
                        : <span className="text-gray-300">—</span>}
                    </span>
                    <span className="col-span-1 text-right text-xs text-gray-500 tabular-nums pt-0.5">
                      {stats && stats.durationSeconds > 0 ? formatTime(stats.durationSeconds) : "—"}
                    </span>
                    <span className="col-span-2 text-right text-xs text-gray-400 pt-0.5">
                      {stats?.lastActive ? formatDate(stats.lastActive) : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><span className="bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">None</span> Never opened</span>
          <span className="flex items-center gap-1.5"><span className="bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">Low</span> 1–2 sessions, &lt;10 messages</span>
          <span className="flex items-center gap-1.5"><span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Medium</span> 3–5 sessions or 10–25 messages</span>
          <span className="flex items-center gap-1.5"><span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">✦ High</span> 6+ sessions or 26+ messages</span>
        </div>
      </section>

      {/* ── System Access Logs ── */}
      <section>
        <h3 className="text-base font-semibold mb-1">System Access Logs</h3>
        <p className="text-xs text-gray-400 mb-4">Last platform activity per learner, based on lesson session data.</p>
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50 grid grid-cols-12 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <span className="col-span-5">Learner</span>
            <span className="col-span-4 text-right">Time on platform</span>
            <span className="col-span-3 text-right">Last active</span>
          </div>
          {learnerAccessRows.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-400 text-center">No learners enrolled.</p>
          ) : (
            <div className="divide-y">
              {learnerAccessRows.map((r) => (
                <div key={r.uid} className="px-5 py-3 grid grid-cols-12 items-center text-sm">
                  <div className="col-span-5 flex items-center gap-2">
                    <span
                      className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                        !r.lastActivity ? "bg-gray-200" :
                        new Date(r.lastActivity) > new Date(Date.now() - 7 * 86400_000) ? "bg-green-400" :
                        new Date(r.lastActivity) > new Date(Date.now() - 14 * 86400_000) ? "bg-amber-400" : "bg-red-400"
                      }`}
                      title={!r.lastActivity ? "Never logged in" : "Last activity"}
                    />
                    <span className="font-medium text-gray-800 truncate">{r.name}</span>
                  </div>
                  <span className="col-span-4 text-right text-xs text-gray-600">{formatTime(r.totalTime)}</span>
                  <span className="col-span-3 text-right text-xs text-gray-400">{formatDate(r.lastActivity)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          <span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-1" />active &lt;7 days ·
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400 mx-1" />7–14 days ·
          <span className="inline-block w-2 h-2 rounded-full bg-red-400 mx-1" />&gt;14 days
        </p>
      </section>
    </div>
  );

  const quizContent = (
    <QuizAnalysisSection
      courseId={params.id}
      courseTitle={course.title}
      quizStats={quizStats}
      atRiskLearners={atRiskLearners}
      isCohortLimited={isCohortLimited}
    />
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">Analytics</h2>
        <p className="text-sm text-gray-500">
          Assessment results, AI Coach engagement, and system access for {course.title}.
          {isCohortLimited && (
            <span className="ml-2 text-blue-600 font-medium">Showing your cohort ({cohortIds!.length} learners).</span>
          )}
        </p>
      </div>

      <AnalyticsTabs overviewContent={overviewContent} quizContent={quizContent} />
    </div>
  );
}
