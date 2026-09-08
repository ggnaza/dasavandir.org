import Link from "next/link";
import { notFound } from "next/navigation";
import { gnahatumDb } from "@/lib/gnahatum/db";
import { COGNITIVE_LEVELS, POINT_DISTRIBUTION } from "@/lib/gnahatum/constants";
import type { ScoredItem } from "@/lib/gnahatum/constants";
import { ResultEditor } from "@/components/gnahatum/result-editor";
import { formatPoints } from "@/lib/gnahatum/format";

export default async function ResultDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = gnahatumDb();

  const { data: result } = await db
    .from("results")
    .select(`
      id,
      total_score,
      max_score,
      items,
      teacher_total,
      teacher_items,
      reviewed,
      reviewed_by,
      reviewed_at,
      corrected_by,
      corrected_at,
      created_at,
      scans:scan_id (
        id,
        student_name,
        teacher_name,
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

  const currentItems = ((result.teacher_items ?? result.items) ?? []) as ScoredItem[];
  const aiItems = (result.items ?? []) as ScoredItem[];
  const finalScore = result.teacher_total ?? result.total_score;
  const pct = result.max_score > 0 ? (finalScore / result.max_score) * 100 : 0;
  const wasCorrected = result.teacher_total !== null;

  const levelScores = Object.entries(COGNITIVE_LEVELS).map(([key, level]) => {
    const levelItems = currentItems.filter((i) => (level.questions as readonly number[]).includes(i.number));
    const earned = levelItems.reduce((s, i) => s + i.awarded_points, 0);
    return { key, ...level, earned, max: level.points };
  });

  const lowConfidence = currentItems.filter((i) => i.confidence < 0.7);
  // Items the scorer positively identified as unsafe — it contradicted its own
  // arithmetic, or graded by reference to the teacher's marks. Distinct from
  // low confidence, which is only about reading the handwriting.
  const flagged = currentItems.filter((i) => (i.review_flags?.length ?? 0) > 0);

  // Fetch correction history
  const { data: corrections } = await db
    .from("corrections")
    .select("id, question_number, ai_score, teacher_score, reason, created_at")
    .eq("result_id", id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/gnahatum/results" className="text-gray-500 hover:text-gray-700">
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
            {scan?.teacher_name && (
              <p className="text-sm text-gray-500 mt-1">Teacher: {scan.teacher_name}</p>
            )}
            <p className="text-sm text-gray-400 mt-1">
              Scored {new Date(result.created_at).toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <div className={`text-4xl font-bold ${pct >= 70 ? "text-green-600" : pct >= 40 ? "text-yellow-600" : "text-red-600"}`}>
              {formatPoints(finalScore)}
            </div>
            <div className="text-gray-400">/ {result.max_score} ({pct.toFixed(0)}%)</div>
            {wasCorrected && (
              <div className="text-xs text-gray-400 mt-1">
                AI score: {formatPoints(result.total_score)} | Corrected: {new Date(result.corrected_at!).toLocaleDateString()}
              </div>
            )}
            <div className="mt-2">
              {wasCorrected ? (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                  Teacher Corrected
                </span>
              ) : result.reviewed ? (
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
                  {formatPoints(level.earned)}
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
      {flagged.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="font-medium text-red-800 mb-1">Needs a human check</h3>
          <ul className="text-sm text-red-700 list-disc pl-5 space-y-0.5">
            {flagged.map((i) => (
              <li key={i.number}>
                Q{i.number} — {(i.review_flags ?? []).join("; ")}
              </li>
            ))}
          </ul>
          <p className="text-sm text-red-700 mt-2">
            These scores were not reached independently, or do not match the model&apos;s own
            working. Correct them below — the correction is stored and applied to future scans
            of this test.
          </p>
        </div>
      )}

      {lowConfidence.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="font-medium text-amber-800 mb-1">Low Confidence Readings</h3>
          <p className="text-sm text-amber-700">
            Questions {lowConfidence.map((i) => `#${i.number}`).join(", ")} had confidence below 70%.
            Consider reviewing these manually.
          </p>
        </div>
      )}

      {/* Per-question table with inline editing */}
      <ResultEditor
        resultId={result.id}
        items={currentItems}
        aiItems={aiItems}
        wasCorrected={wasCorrected}
      />

      {/* Correction history */}
      {corrections && corrections.length > 0 && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Correction History</h2>
          <div className="space-y-2">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {corrections.map((c: any) => (
              <div key={c.id} className="flex items-center gap-4 text-sm border-b pb-2">
                <span className="font-medium text-gray-700">Q{c.question_number}</span>
                <span className="text-red-500 line-through">{c.ai_score}</span>
                <span className="text-gray-400">&rarr;</span>
                <span className="text-green-600 font-medium">{c.teacher_score}</span>
                {c.reason && <span className="text-gray-500 italic">&quot;{c.reason}&quot;</span>}
                <span className="text-gray-400 text-xs ml-auto">
                  {new Date(c.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
