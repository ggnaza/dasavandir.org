"use client";
import { useState } from "react";

export type QuizStat = {
  quizId: string;
  lessonOrder: number;
  lessonTitle: string;
  uniqueAttemptors: number;
  cohortSize: number;
  completionPct: number;
  cohortAvgScore: number | null;
  questions: {
    text: string;
    successPct: number | null;
    totalResponses: number;
    distractors: { text: string; count: number; isCorrect: boolean }[];
  }[];
};

export type AtRiskLearner = {
  name: string;
  failedQuizCount: number;
  weakModules: string;
};

const WEAK_QUIZ_THRESHOLD = 50;    // cohort avg below this = weak quiz
const WEAK_Q_THRESHOLD    = 60;    // question success below this = flag it
const AT_RISK_THRESHOLD   = 60;    // individual score below this = "failed"
const AT_RISK_COUNT       = 2;     // failed on this many quizzes = at-risk

function ScoreBar({ pct, dim = false }: { pct: number; dim?: boolean }) {
  const color =
    pct >= 80 ? "bg-green-500" :
    pct >= 60 ? "bg-green-300" :
    pct >= 40 ? "bg-amber-400" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="w-20 h-2 rounded-full bg-gray-100 shrink-0 overflow-hidden">
        <div className={`h-full rounded-full ${color} ${dim ? "opacity-40" : ""}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs tabular-nums font-medium ${dim ? "text-gray-400" : "text-gray-700"}`}>
        {pct}%
      </span>
    </div>
  );
}

function StatusBadge({ avg }: { avg: number | null }) {
  if (avg === null) return <span className="text-xs text-gray-300">—</span>;
  if (avg >= 80) return <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Strong</span>;
  if (avg >= WEAK_QUIZ_THRESHOLD) return <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Moderate</span>;
  return <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">⚠ Weak</span>;
}

export function QuizAnalysisSection({
  courseId,
  courseTitle,
  quizStats,
  atRiskLearners,
  isCohortLimited,
}: {
  courseId: string;
  courseTitle: string;
  quizStats: QuizStat[];
  atRiskLearners: AtRiskLearner[];
  isCohortLimited: boolean;
}) {
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState("");
  const [expandedQuiz, setExpandedQuiz] = useState<string | null>(null);

  const weakQuizzes = quizStats.filter(
    (q) => q.cohortAvgScore !== null && q.cohortAvgScore < WEAK_QUIZ_THRESHOLD
  );

  const hasData = quizStats.some((q) => q.uniqueAttemptors > 0);

  async function generateInsights() {
    setGenerating(true);
    setAiError("");

    const payload = {
      courseTitle,
      cohortSize: quizStats[0]?.cohortSize ?? 0,
      isCohortLimited,
      weakQuizzes: weakQuizzes.map((q) => ({
        lessonOrder: q.lessonOrder,
        lessonTitle: q.lessonTitle,
        completionPct: q.completionPct,
        cohortAvgScore: q.cohortAvgScore,
        weakQuestions: q.questions
          .filter((qn) => qn.successPct !== null && qn.successPct < WEAK_Q_THRESHOLD)
          .map((qn) => {
            const topWrong = qn.distractors
              .filter((d) => !d.isCorrect)
              .sort((a, b) => b.count - a.count)[0];
            return {
              questionText: qn.text,
              successPct: qn.successPct,
              topWrongAnswer: topWrong?.text ?? null,
              topWrongCount: topWrong?.count ?? 0,
            };
          }),
      })),
      allQuizzes: quizStats.map((q) => ({
        lessonOrder: q.lessonOrder,
        lessonTitle: q.lessonTitle,
        completionPct: q.completionPct,
        cohortAvgScore: q.cohortAvgScore,
      })),
    };

    const res = await fetch(`/api/admin/courses/${courseId}/quiz-insights`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      setAiError(await res.text());
      setGenerating(false);
      return;
    }

    const { insight } = await res.json();
    setAiInsight(insight);
    setGenerating(false);
  }

  if (quizStats.length === 0) {
    return (
      <div className="bg-white border rounded-xl p-10 text-center text-gray-400">
        No quizzes found in this course.
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* ── Completion Overview ──────────────────────────────────────────── */}
      <section>
        <h3 className="text-base font-semibold mb-1">Completion &amp; Scores</h3>
        <p className="text-xs text-gray-400 mb-4">
          How many learners attempted each quiz and how the cohort scored on average.
        </p>

        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50 grid grid-cols-12 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <span className="col-span-4">Module / Quiz</span>
            <span className="col-span-2 text-right">Completion</span>
            <span className="col-span-3 text-center">Cohort avg</span>
            <span className="col-span-2 text-center">Status</span>
            <span className="col-span-1" />
          </div>
          <div className="divide-y">
            {quizStats.map((q) => (
              <div key={q.quizId} className="px-5 py-3 grid grid-cols-12 items-center text-sm">
                <div className="col-span-4">
                  <span className="text-xs text-gray-400 mr-1">M{q.lessonOrder}</span>
                  <span className="font-medium text-gray-800">{q.lessonTitle}</span>
                </div>
                <div className="col-span-2 text-right text-xs text-gray-600 tabular-nums">
                  {q.uniqueAttemptors}/{q.cohortSize}
                  <span className="text-gray-400 ml-1">({q.completionPct}%)</span>
                </div>
                <div className="col-span-3 flex justify-center">
                  {q.cohortAvgScore !== null
                    ? <ScoreBar pct={q.cohortAvgScore} />
                    : <span className="text-xs text-gray-300">No data</span>}
                </div>
                <div className="col-span-2 flex justify-center">
                  <StatusBadge avg={q.cohortAvgScore} />
                </div>
                <div className="col-span-1 flex justify-end">
                  <button
                    onClick={() => setExpandedQuiz(expandedQuiz === q.quizId ? null : q.quizId)}
                    className="text-xs text-brand-600 hover:underline"
                  >
                    {expandedQuiz === q.quizId ? "Hide" : "Detail"}
                  </button>
                </div>

                {/* Inline question detail */}
                {expandedQuiz === q.quizId && (
                  <div className="col-span-12 mt-3 border-t pt-3 space-y-2">
                    {q.questions.length === 0 ? (
                      <p className="text-xs text-gray-400">No question data.</p>
                    ) : (
                      q.questions.map((qn, i) => {
                        const isWeak = qn.successPct !== null && qn.successPct < WEAK_Q_THRESHOLD;
                        const topWrong = [...qn.distractors]
                          .filter((d) => !d.isCorrect)
                          .sort((a, b) => b.count - a.count)[0];

                        return (
                          <div
                            key={i}
                            className={`rounded-lg px-3 py-2.5 ${isWeak ? "bg-red-50 border border-red-100" : "bg-gray-50"}`}
                          >
                            <div className="flex items-start gap-3">
                              <span className="text-xs text-gray-400 w-5 shrink-0 pt-0.5">Q{i + 1}</span>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm leading-snug ${isWeak ? "text-red-800 font-medium" : "text-gray-700"}`}>
                                  {qn.text}
                                </p>
                                {qn.successPct !== null && (
                                  <div className="mt-1.5 flex items-center gap-3 flex-wrap">
                                    <ScoreBar pct={qn.successPct} dim={!isWeak} />
                                    <span className="text-xs text-gray-400">
                                      {qn.totalResponses} response{qn.totalResponses !== 1 ? "s" : ""}
                                    </span>
                                    {isWeak && topWrong && topWrong.count > 0 && (
                                      <span className="text-xs text-red-600">
                                        Most chose: <strong>"{topWrong.text}"</strong> ({topWrong.count}×)
                                      </span>
                                    )}
                                  </div>
                                )}
                                {/* Option breakdown for weak questions */}
                                {isWeak && qn.distractors.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {qn.distractors.map((d, di) => (
                                      <span
                                        key={di}
                                        className={`text-xs px-2 py-0.5 rounded-full border ${
                                          d.isCorrect
                                            ? "bg-green-50 border-green-300 text-green-700 font-medium"
                                            : d.count > 0
                                            ? "bg-red-50 border-red-200 text-red-700"
                                            : "bg-gray-50 border-gray-200 text-gray-400"
                                        }`}
                                      >
                                        {d.isCorrect ? "✓ " : ""}
                                        {d.text.length > 40 ? d.text.slice(0, 40) + "…" : d.text}
                                        {d.count > 0 && <span className="ml-1 opacity-70">{d.count}</span>}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── At-risk learners ─────────────────────────────────────────────── */}
      {atRiskLearners.length > 0 && (
        <section>
          <h3 className="text-base font-semibold mb-1">At-Risk Learners</h3>
          <p className="text-xs text-gray-400 mb-4">
            Learners who scored below {AT_RISK_THRESHOLD}% on {AT_RISK_COUNT}+ quizzes.
          </p>
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="divide-y">
              {atRiskLearners.map((l, i) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-800">{l.name}</span>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="text-red-600 font-medium">{l.failedQuizCount} quiz{l.failedQuizCount !== 1 ? "zes" : ""} below {AT_RISK_THRESHOLD}%</span>
                    <span className="text-gray-400">{l.weakModules}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── AI Insights ──────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-semibold">✦ AI Knowledge Gap Analysis</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              AI identifies concept-level gaps and misconceptions across the cohort.
              Based on quiz scores and wrong-answer patterns.
            </p>
          </div>
          <button
            onClick={generateInsights}
            disabled={generating || !hasData}
            className="shrink-0 flex items-center gap-1.5 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            {generating ? (
              <><span className="animate-spin text-base">⟳</span> Analysing…</>
            ) : aiInsight ? (
              "↻ Regenerate"
            ) : (
              "✦ Generate insights"
            )}
          </button>
        </div>

        {!hasData && (
          <div className="bg-gray-50 border rounded-xl p-6 text-center text-sm text-gray-400">
            No quiz responses yet — insights will be available once learners start taking quizzes.
          </div>
        )}

        {aiError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{aiError}</div>
        )}

        {aiInsight && (
          <div className="bg-white border border-brand-200 rounded-xl p-5">
            <p className="text-xs font-semibold text-brand-700 uppercase tracking-wide mb-3">
              ✦ AI Analysis
            </p>
            <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{aiInsight}</div>
            <p className="text-xs text-gray-400 mt-4">
              Based on {quizStats.reduce((s, q) => s + q.uniqueAttemptors, 0)} quiz submissions.
              Click "↻ Regenerate" to refresh.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
