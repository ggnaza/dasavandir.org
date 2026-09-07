import Link from "next/link";
import { ararkaDb } from "@/lib/ararka/db";

export default async function ResultsPage() {
  const db = ararkaDb();

  const { data: results } = await db
    .from("results")
    .select(`
      id,
      total_score,
      max_score,
      reviewed,
      created_at,
      scans:scan_id (
        id,
        student_name,
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
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Results</h1>

      {!results?.length ? (
        <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
          <p className="text-lg font-medium">No results yet</p>
          <p className="mt-1">
            <Link href="/ararka/scan" className="text-blue-600 hover:underline">
              Upload & score a scan
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
                <th className="py-3 px-4 font-medium text-gray-500">Score</th>
                <th className="py-3 px-4 font-medium text-gray-500">Status</th>
                <th className="py-3 px-4 font-medium text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {results.map((r: any) => {
                const scan = r.scans;
                const test = scan?.tests;
                const subject = test?.subjects;
                const pct = r.max_score > 0 ? (r.total_score / r.max_score) * 100 : 0;

                return (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <Link
                        href={`/ararka/results/${r.id}`}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {scan?.student_name || "Unknown"}
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      {subject?.name_hy ?? subject?.name_en ?? "—"}
                    </td>
                    <td className="py-3 px-4">{test?.grade ?? "—"}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-medium ${pct >= 70 ? "text-green-600" : pct >= 40 ? "text-yellow-600" : "text-red-600"}`}
                      >
                        {r.total_score.toFixed(1)}
                      </span>
                      <span className="text-gray-400"> / {r.max_score}</span>
                      <span className="text-gray-400 text-xs ml-1">({pct.toFixed(0)}%)</span>
                    </td>
                    <td className="py-3 px-4">
                      {r.reviewed ? (
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
