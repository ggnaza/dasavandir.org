import { ararkaDb } from "@/lib/ararka/db";
import { BatchUploader } from "@/components/ararka/batch-uploader";

export default async function ScanPage() {
  const db = ararkaDb();

  const { data: subjects } = await db
    .from("subjects")
    .select("id, name_hy, name_en, sort_order")
    .order("sort_order");

  const { data: tests } = await db
    .from("tests")
    .select("id, subject_id, grade, test_type, year")
    .in("test_type", ["diagnostic", "diagnostic_base", "diagnostic_target"])
    .order("grade");

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Upload & Score Tests</h1>
      <p className="text-gray-600 mb-6">
        Upload a PDF containing all student test scans. The system will split
        the PDF by pages-per-student, extract names, and score each test
        automatically.
      </p>
      <BatchUploader subjects={subjects ?? []} tests={tests ?? []} />
    </div>
  );
}
