import Link from "next/link";
import { notFound } from "next/navigation";
import { ararkaDb } from "@/lib/ararka/db";
import { COGNITIVE_LEVELS, POINT_DISTRIBUTION } from "@/lib/ararka/constants";
import type { ScoredItem } from "@/lib/ararka/constants";

export default async function ResultDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = ararkaDb();

  const { data: result } = await db
    .from("results")
    .select(`
      id,
      total_score,
      max_score,
      items,
      reviewed,
      reviewed_by,
      reviewed_at,
      created_at,
      scans:scan_id (
        id,
        student_name,
        teacher_id,
        status,
        tests:test_id (
          id,
          grade,
          test_type,
          year,
          subjects:subject_id (name_hy, name_en)
        )
      )
    `)
    .eq("id", id)
    .single();

  if (!result) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scan = (result as any).scans;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const test = scan?.tests as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subject = test?.subjects as any;
  const items = (result.items ?? []) as ScoredItem[];
  const pct = result.max_score > 0 ? (result.total_score / result.max_score) * 100 : 0;

  const levelScores = Object.entries(COGNITIVE_LEVELS).map(([key, level]) => {
    const levelItems = items.filter((i) => (level.questions as readonly number[]).includes(i.number));
    const earned = levelItems.reduce((s, i) => s + i.awarded_points, 0);
    return { key, ...level, earned, max: level.points };
  });

  const lowConfidence = items.filter((i) => i.confidence < 0.7);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/ararka/results" className="text-gray-500 hover:text-gray-700">
          &larr; Results
        </Link>
      </div>

      {/* Header */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {scan?.student_name || "Unknown Student"}
            </h1>
            <p className="text-gray-600 mt-1">
              {subject?.name_hy} ({subject?.name_en}) — Grade {test?.grade} — {test?.test_type}{" "}
              {test?.year}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Scored {new Date(result.created_at).toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <div className={`text-4xl font-bold ${pct >= 70 ? "text-green-600" : pct >= 40 ? "text-yellow-600" : "text-red-600"}`}>
              {result.total_score.toFixed(1)}
            </div>
            <div className="text-gray-400">/ {result.max_score} ({pct.toFixed(0)}%)</div>
            <div className="mt-2">
              {result.reviewed ? (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
                  Reviewed
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700">
                  AI Scored — Pending Review
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cognitive level breakdown */}
      <div className="grid gap-4 sm:grid-cols-3">
        {levelScores.map((level) => {
          const levelPct = level.max > 0 ? (level.earned / level.max) * 100 : 0;
          return (
            <div key={level.key} className="bg-white rounded-lg border p-4">
              <div className="text-sm text-gray-500">{level.label_en}</div>
              <div className="text-sm text-gray-400">{level.label_hy}</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-900">
                  {level.earned.toFixed(1)}
                </span>
                <span className="text-gray-400">/ {level.max}</span>
              </div>
              <div className="mt-2 w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${levelPct >= 70 ? "bg-green-500" : levelPct >= 40 ? "bg-yellow-500" : "bg-red-500"}`}
                  style={{ width: `${levelPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Low confidence warnings */}
      {lowConfidence.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="font-medium text-amber-800 mb-1">Low Confidence Readings</h3>
          <p className="text-sm text-amber-700">
            Questions {lowConfidence.map((i) => `#${i.number}`).join(", ")} had confidence below 70%.
            Consider reviewing these manually.
          </p>
        </div>
      )}

      {/* Per-question table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="py-3 px-4 font-medium text-gray-500">Q#</th>
                <th className="py-3 px-4 font-medium text-gray-500">Level</th>
                <th className="py-3 px-4 font-medium text-gray-500">Student Answer</th>
                <th className="py-3 px-4 font-medium text-gray-500">Correct Answer</th>
                <th className="py-3 px-4 font-medium text-gray-500">Points</th>
                <th className="py-3 px-4 font-medium text-gray-500">Confidence</th>
                <th className="py-3 px-4 font-medium text-gray-500">Note</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const level = Object.entries(COGNITIVE_LEVELS).find(([, l]) =>
                  (l.questions as readonly number[]).includes(item.number),
                );
                const maxPts = POINT_DISTRIBUTION[item.number] ?? 0;

                return (
                  <tr
                    key={item.number}
                    className={`border-b ${item.awarded_points === maxPts ? "" : item.awarded_points > 0 ? "bg-yellow-50" : "bg-red-50"}`}
                  >
                    <td className="py-3 px-4 font-medium">{item.number}</td>
                    <td className="py-3 px-4 text-gray-500 text-xs">
                      {level ? level[1].label_en : "—"}
                    </td>
                    <td className="py-3 px-4 max-w-[200px]">
                      <span className="whitespace-pre-wrap break-words">{item.extracted_answer}</span>
                    </td>
                    <td className="py-3 px-4 max-w-[200px]">
                      <span className="whitespace-pre-wrap break-words">{item.correct_answer}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-medium ${item.awarded_points === maxPts ? "text-green-600" : item.awarded_points > 0 ? "text-yellow-600" : "text-red-600"}`}
                      >
                        {item.awarded_points}
                      </span>
                      <span className="text-gray-400"> / {maxPts}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <div className="w-14 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${item.confidence >= 0.8 ? "bg-green-500" : item.confidence >= 0.5 ? "bg-yellow-500" : "bg-red-500"}`}
                            style={{ width: `${item.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400">
                          {Math.round(item.confidence * 100)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-500 max-w-[250px]">
                      {item.explanation}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
