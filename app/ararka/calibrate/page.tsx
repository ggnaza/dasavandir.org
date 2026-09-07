import Link from "next/link";
import { ararkaDb } from "@/lib/ararka/db";

export default async function CalibratePage() {
  const db = ararkaDb();

  const { data: calibrations } = await db
    .from("calibrations")
    .select(`
      id,
      human_total,
      ai_total,
      delta,
      created_at,
      scans:scan_id (
        id,
        student_name,
        tests:test_id (
          grade,
          test_type,
          year,
          subjects:subject_id (name_hy, name_en)
        )
      )
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  const calData = calibrations ?? [];
  const avgDelta =
    calData.length > 0
      ? calData.reduce((s: number, c: { delta?: number | null }) => s + Math.abs(c.delta ?? 0), 0) / calData.length
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calibration</h1>
          <p className="text-gray-600 mt-1">
            Compare AI scores against human-graded results to measure accuracy.
          </p>
        </div>
      </div>

      {/* Stats */}
      {calData.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="bg-white rounded-lg border p-4">
            <div className="text-sm text-gray-500">Total Calibrations</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{calData.length}</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-sm text-gray-500">Avg Absolute Delta</div>
            <div className={`text-2xl font-bold mt-1 ${avgDelta <= 1 ? "text-green-600" : avgDelta <= 2 ? "text-yellow-600" : "text-red-600"}`}>
              {avgDelta.toFixed(2)} pts
            </div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-sm text-gray-500">Accuracy Zone</div>
            <div className={`text-2xl font-bold mt-1 ${avgDelta <= 1 ? "text-green-600" : avgDelta <= 2 ? "text-yellow-600" : "text-red-600"}`}>
              {avgDelta <= 0.5 ? "Excellent" : avgDelta <= 1 ? "Good" : avgDelta <= 2 ? "Fair" : "Needs work"}
            </div>
          </div>
        </div>
      )}

      {/* How to calibrate */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
        <h3 className="font-medium text-blue-800 mb-2">How to Calibrate</h3>
        <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
          <li>Upload a scan that has already been graded by a teacher</li>
          <li>Let the AI score it</li>
          <li>From the result page, enter the human score to create a calibration record</li>
          <li>Review the per-question deltas to identify systematic AI errors</li>
        </ol>
      </div>

      {/* Calibration table */}
      {calData.length === 0 ? (
        <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
          <p className="text-lg font-medium">No calibration data yet</p>
          <p className="mt-1">
            <Link href="/ararka/scan" className="text-blue-600 hover:underline">
              Score a previously graded test
            </Link>{" "}
            and add human scores to start calibrating.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="py-3 px-4 font-medium text-gray-500">Student</th>
                <th className="py-3 px-4 font-medium text-gray-500">Subject</th>
                <th className="py-3 px-4 font-medium text-gray-500">Human Score</th>
                <th className="py-3 px-4 font-medium text-gray-500">AI Score</th>
                <th className="py-3 px-4 font-medium text-gray-500">Delta</th>
                <th className="py-3 px-4 font-medium text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {calData.map((c: any) => {
                const scan = c.scans;
                const test = scan?.tests;
                const subject = test?.subjects;
                const absDelta = Math.abs(c.delta ?? 0);

                return (
                  <tr key={c.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">
                      {scan?.student_name || "Unknown"}
                    </td>
                    <td className="py-3 px-4">
                      {subject?.name_hy ?? subject?.name_en ?? "—"} Gr.{test?.grade}
                    </td>
                    <td className="py-3 px-4">{c.human_total?.toFixed(1) ?? "—"}</td>
                    <td className="py-3 px-4">{c.ai_total?.toFixed(1) ?? "—"}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-medium ${absDelta <= 0.5 ? "text-green-600" : absDelta <= 1 ? "text-yellow-600" : "text-red-600"}`}
                      >
                        {c.delta > 0 ? "+" : ""}{c.delta?.toFixed(1) ?? "—"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-500">
                      {new Date(c.created_at).toLocaleDateString()}
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
