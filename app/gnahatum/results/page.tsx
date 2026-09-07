import Link from "next/link";
import { gnahatumDb } from "@/lib/gnahatum/db";

export default async function ResultsPage() {
  const db = gnahatumDb();

  const { data: results } = await db
    .from("results")
    .select(`
      id,
      total_score,
      max_score,
      teacher_total,
      reviewed,
      corrected_at,
      created_at,
      scans:scan_id (
        id,
        student_name,
        teacher_name,
        status,
        batch_id,
        tests:test_id (
          id,
          grade,
          test_type,
          year,
          subjects:subject_id (name_hy, name_en)
        )
      )
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  // Group by batch_id for display
  const batches = new Map<string, typeof results>();
  const unbatched: typeof results = [];
  for (const r of results ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scan = (r as any).scans;
    const bid = scan?.batch_id;
    if (bid) {
      if (!batches.has(bid)) batches.set(bid, []);
      batches.get(bid)!.push(r);
    } else {
      unbatched.push(r);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Results</h1>

      {!results?.length ? (
        <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
          <p className="text-lg font-medium">No results yet</p>
          <p className="mt-1">
            <Link href="/gnahatum/scan" className="text-blue-600 hover:underline">
              Upload & score tests
            </Link>{" "}
            to see results here.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="py-3 px-4 font-medium text-gray-500">Student</th>
                <th className="py-3 px-4 font-medium text-gray-500">Subject</th>
                <th className="py-3 px-4 font-medium text-gray-500">Grade</th>
                <th className="py-3 px-4 font-medium text-gray-500">AI Score</th>
                <th className="py-3 px-4 font-medium text-gray-500">Final Score</th>
                <th className="py-3 px-4 font-medium text-gray-500">Status</th>
                <th className="py-3 px-4 font-medium text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(results ?? []).map((r: any) => {
                const scan = r.scans;
                const test = scan?.tests;
                const subject = test?.subjects;
                const finalScore = r.teacher_total ?? r.total_score;
                const pct = r.max_score > 0 ? (finalScore / r.max_score) * 100 : 0;
                const wasCorrected = r.teacher_total !== null && r.teacher_total !== r.total_score;

                return (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <Link
                        href={`/gnahatum/results/${r.id}`}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {scan?.student_name || "Unknown"}
                      </Link>
                      {scan?.teacher_name && (
                        <span className="block text-xs text-gray-400">
                          Teacher: {scan.teacher_name}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {subject?.name_hy ?? subject?.name_en ?? "—"}
                    </td>
                    <td className="py-3 px-4">{test?.grade ?? "—"}</td>
                    <td className="py-3 px-4 text-gray-500">
                      {r.total_score.toFixed(1)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`font-medium ${pct >= 70 ? "text-green-600" : pct >= 40 ? "text-yellow-600" : "text-red-600"}`}>
                        {finalScore.toFixed(1)}
                      </span>
                      <span className="text-gray-400"> / {r.max_score}</span>
                      <span className="text-gray-400 text-xs ml-1">({pct.toFixed(0)}%)</span>
                    </td>
                    <td className="py-3 px-4">
                      {wasCorrected ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                          Corrected
                        </span>
                      ) : r.reviewed ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                          Reviewed
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700">
                          AI Scored
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-500">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
