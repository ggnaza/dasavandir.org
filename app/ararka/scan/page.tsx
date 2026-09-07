import { ararkaDb } from "@/lib/ararka/db";
import { ScanUploader } from "@/components/ararka/scan-uploader";

export default async function ScanPage() {
  const db = ararkaDb();

  const { data: subjects } = await db
    .from("subjects")
    .select("id, name_hy, name_en, sort_order")
    .order("sort_order");

  const { data: tests } = await db
    .from("tests")
    .select("id, subject_id, grade, test_type, year")
    .eq("test_type", "diagnostic")
    .order("grade");

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Upload & Score</h1>
      <ScanUploader subjects={subjects ?? []} tests={tests ?? []} />
    </div>
  );
}
