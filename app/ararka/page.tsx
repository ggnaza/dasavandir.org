import Link from "next/link";
import { ararkaDb } from "@/lib/ararka/db";

export default async function ArarkaHome() {
  const db = ararkaDb();

  const { data: subjects } = await db
    .from("subjects")
    .select("id, name_hy, name_en, sort_order")
    .order("sort_order");

  const { data: tests } = await db
    .from("tests")
    .select("id, subject_id, grade, test_type, year, total_points")
    .in("test_type", ["diagnostic", "diagnostic_base", "diagnostic_target"])
    .order("grade");

  const testsBySubject = (tests ?? []).reduce(
    (acc: Record<string, typeof tests>, t: { subject_id: string }) => {
      if (!acc[t.subject_id]) acc[t.subject_id] = [];
      acc[t.subject_id].push(t);
      return acc;
    },
    {} as Record<string, typeof tests>,
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Diagnostic Tests</h1>
        <p className="text-gray-600 mt-1">
          Select a subject to view available tests and upload scans for scoring.
        </p>
      </div>

      {!subjects?.length ? (
        <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
          <p className="text-lg font-medium">No subjects configured yet</p>
          <p className="mt-1">Run the ararka_schema.sql migration to set up the database.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(subjects ?? []).map((subject: { id: string; name_hy: string; name_en: string }) => {
            const subjectTests = testsBySubject[subject.id] ?? [];
            const grades = subjectTests.map((t: { grade: number }) => t.grade).sort((a: number, b: number) => a - b);

            return (
              <div
                key={subject.id}
                className="bg-white rounded-lg border p-5 hover:shadow-md transition-shadow"
              >
                <h3 className="font-semibold text-gray-900">{subject.name_hy}</h3>
                <p className="text-sm text-gray-500">{subject.name_en}</p>

                {grades.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {grades.map((grade: number) => {
                      const test = subjectTests.find((t: { grade: number }) => t.grade === grade);
                      return (
                        <Link
                          key={grade}
                          href={`/ararka/tests/${test.id}`}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                        >
                          Grade {grade}
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-gray-400 italic">No tests added yet</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8 flex gap-4">
        <Link
          href="/ararka/scan"
          className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
        >
          Upload & Score a Scan
        </Link>
      </div>
    </div>
  );
}
