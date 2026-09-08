import Link from "next/link";
import { redirect } from "next/navigation";
import { getGnahatumUser } from "@/lib/gnahatum/auth";
import { gnahatumDb } from "@/lib/gnahatum/db";
import { TestManager, type TestRow } from "@/components/gnahatum/test-manager";
import type { AnswerKeyItem } from "@/lib/gnahatum/constants";

export const dynamic = "force-dynamic";

export default async function ManageTestsPage() {
  const user = await getGnahatumUser();
  if (!user) redirect("/auth/login");
  if (!user.isLdm && user.role !== "admin") redirect("/gnahatum");

  const db = gnahatumDb();

  const [{ data: subjects }, { data: tests }, { data: scans }] = await Promise.all([
    db.from("subjects").select("id, name_hy, name_en, sort_order").order("sort_order"),
    db.from("tests").select("id, subject_id, grade, test_type, year, answer_key, source_file_id"),
    db.from("scans").select("test_id"),
  ]);

  const scanCounts = new Map<string, number>();
  for (const s of (scans ?? []) as Array<{ test_id: string }>) {
    scanCounts.set(s.test_id, (scanCounts.get(s.test_id) ?? 0) + 1);
  }

  // The keys themselves stay on the server — a subject's worth of them runs to
  // hundreds of kilobytes. The client gets a completeness count and fetches the
  // one key it is actually editing.
  const rows: TestRow[] = (
    (tests ?? []) as Array<{
      id: string;
      subject_id: string;
      grade: number;
      test_type: string;
      year: string;
      answer_key: AnswerKeyItem[] | null;
      source_file_id: string | null;
    }>
  ).map((t) => ({
    id: t.id,
    subject_id: t.subject_id,
    grade: t.grade,
    test_type: t.test_type,
    year: t.year,
    source_file_id: t.source_file_id,
    answered: (t.answer_key ?? []).filter((i) => (i?.answer ?? "").trim() !== "").length,
    scan_count: scanCounts.get(t.id) ?? 0,
  }));

  const incomplete = rows.filter((r) => r.answered < 15).length;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Tests and answer keys</h1>
          <Link href="/gnahatum" className="text-sm text-gray-600 hover:text-gray-900">
            ← All tests
          </Link>
        </div>
        <p className="text-gray-600 mt-1">
          Pick a subject to see every test it has, check its answer key, and replace anything that is
          wrong. {rows.length} test{rows.length === 1 ? "" : "s"} stored
          {incomplete > 0 && (
            <span className="text-red-600 font-medium">
              {" "}
              · {incomplete} with an incomplete key
            </span>
          )}
          .
        </p>
      </div>

      <TestManager
        subjects={(subjects ?? []) as Array<{ id: string; name_hy: string; name_en: string }>}
        tests={rows}
      />
    </div>
  );
}
