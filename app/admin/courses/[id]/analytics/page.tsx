import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { getModeratorCohort } from "@/lib/get-moderator-cohort";

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

  const [{ data: allEnrollments }, { data: quizzes }, { data: aiMemory }, { data: lastSessions }] = await Promise.all([
    admin.from("enrollments").select("user_id").eq("course_id", params.id),
    lessonIds.length > 0
      ? admin.from("quizzes").select("id, lesson_id, questions").in("lesson_id", lessonIds)
      : Promise.resolve({ data: [] }),
    admin.from("ai_coach_memory").select("user_id, updated_at").eq("course_id", params.id),
    lessonIds.length > 0
      ? admin.from("lesson_sessions").select("user_id, duration_seconds, created_at").in("lesson_id", lessonIds)
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

  // ── Assessment Heatmap ──
  type QuizQuestion = { question: string; options: string[]; correct: number };
  const quizMap = Object.fromEntries(
    (quizzes ?? []).map((q) => [q.id, { lesson_id: q.lesson_id, questions: (q.questions ?? []) as QuizQuestion[] }])
  );
  const lessonMap = Object.fromEntries((lessons ?? []).map((l) => [l.id, l]));

  // Group responses by quiz_id
  const responsesByQuiz: Record<string, Array<{ answers: number[] }>> = {};
  for (const r of quizResponses ?? []) {
    if (!responsesByQuiz[r.quiz_id]) responsesByQuiz[r.quiz_id] = [];
    responsesByQuiz[r.quiz_id].push({ answers: r.answers as number[] });
  }

  // Per-quiz, per-question success rate
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

  // ── AI Coach Matrix ──
  const aiMemoryMap = Object.fromEntries(
    (aiMemory ?? []).map((m) => [m.user_id, m.updated_at])
  );

  // ── System Access Logs (last activity from sessions) ──
  const lastActivityMap: Record<string, string | null> = {};
  const totalTimeMap: Record<string, number> = {};
  for (const s of lastSessions ?? []) {
    if (!lastActivityMap[s.user_id] || s.created_at > (lastActivityMap[s.user_id] ?? "")) {
      lastActivityMap[s.user_id] = s.created_at;
    }
    totalTimeMap[s.user_id] = (totalTimeMap[s.user_id] ?? 0) + (s.duration_seconds ?? 0);
  }

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

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

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-xl font-bold mb-1">Analytics</h2>
        <p className="text-sm text-gray-500">
          Assessment results, AI Coach engagement, and system access for {course.title}.
          {isCohortLimited && (
            <span className="ml-2 text-blue-600 font-medium">Showing your cohort ({cohortIds!.length} learners).</span>
          )}
        </p>
      </div>

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

      {/* ── AI Coach Integration Matrix ── */}
      <section>
        <h3 className="text-base font-semibold mb-1">AI Coach Engagement</h3>
        <p className="text-xs text-gray-400 mb-4">Which learners have used the AI Coach. Chat content is private and not stored here.</p>
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50 grid grid-cols-12 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <span className="col-span-5">Learner</span>
            <span className="col-span-4 text-center">AI Coach</span>
            <span className="col-span-3 text-right">Last interaction</span>
          </div>
          {learnerAccessRows.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-400 text-center">No learners enrolled.</p>
          ) : (
            <div className="divide-y">
              {learnerAccessRows.map((r) => (
                <div key={r.uid} className="px-5 py-3 grid grid-cols-12 items-center text-sm">
                  <span className="col-span-5 font-medium text-gray-800 truncate">{r.name}</span>
                  <span className="col-span-4 text-center">
                    {r.usedAiCoach ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-medium">
                        ✦ Active
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">Not used</span>
                    )}
                  </span>
                  <span className="col-span-3 text-right text-xs text-gray-400">
                    {r.usedAiCoach ? formatDate(r.aiCoachLastUsed) : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
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
}
