import Link from "next/link";
import { notFound } from "next/navigation";
import { gnahatumDb } from "@/lib/gnahatum/db";
import { POINT_DISTRIBUTION, COGNITIVE_LEVELS } from "@/lib/gnahatum/constants";
import type { AnswerKeyItem } from "@/lib/gnahatum/constants";

export default async function TestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = gnahatumDb();

  const { data: test } = await db
    .from("tests")
    .select(`
      id,
      grade,
      test_type,
      year,
      total_points,
      answer_key,
      scoring_notes,
      subjects:subject_id (name_hy, name_en)
    `)
    .eq("id", id)
    .single();

  if (!test) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subject = (test as any).subjects as { name_hy: string; name_en: string } | null;
  const answerKey = (test.answer_key ?? []) as AnswerKeyItem[];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/gnahatum" className="text-gray-500 hover:text-gray-700">
          &larr; Tests
        </Link>
      </div>

      <div className="bg-white rounded-lg border p-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {subject?.name_hy} — Grade {test.grade}
        </h1>
        <p className="text-gray-500 mt-1">
          {subject?.name_en} — {test.test_type} test ({test.year}) — {test.total_points ?? 15} points
        </p>
        {test.scoring_notes && (
          <div className="mt-3 p-3 bg-blue-50 rounded-md text-sm text-blue-800">
            <strong>Scoring notes:</strong> {test.scoring_notes}
          </div>
        )}
      </div>

      {answerKey.length === 0 ? (
        <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
          <p className="text-lg font-medium">No answer key configured</p>
          <p className="mt-1">Answer keys need to be seeded from the diagnostic test documents.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="py-3 px-4 font-medium text-gray-500">Q#</th>
                  <th className="py-3 px-4 font-medium text-gray-500">Points</th>
                  <th className="py-3 px-4 font-medium text-gray-500">Level</th>
                  <th className="py-3 px-4 font-medium text-gray-500">Type</th>
                  <th className="py-3 px-4 font-medium text-gray-500">Correct Answer</th>
                  <th className="py-3 px-4 font-medium text-gray-500">Notes</th>
                </tr>
              </thead>
              <tbody>
                {answerKey.map((item) => {
                  const points = POINT_DISTRIBUTION[item.number] ?? item.points;
                  const level = Object.entries(COGNITIVE_LEVELS).find(([, l]) =>
                    (l.questions as readonly number[]).includes(item.number),
                  );

                  return (
                    <tr key={item.number} className="border-b">
                      <td className="py-3 px-4 font-medium">{item.number}</td>
                      <td className="py-3 px-4">{points}</td>
                      <td className="py-3 px-4 text-xs text-gray-500">
                        {level ? level[1].label_en : "—"}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                          {item.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-[300px]">
                        <span className="whitespace-pre-wrap break-words">{item.answer}</span>
                        {item.sub_parts?.map((sp) => (
                          <div key={sp.label} className="text-xs text-gray-500 mt-1">
                            {sp.label}: {sp.answer} ({sp.points} pts)
                          </div>
                        ))}
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-500 max-w-[200px]">
                        {item.scoring_notes}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex gap-4">
        <Link
          href={`/gnahatum/scan?test=${test.id}`}
          className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
        >
          Score a Scan for This Test
        </Link>
      </div>
    </div>
  );
}
