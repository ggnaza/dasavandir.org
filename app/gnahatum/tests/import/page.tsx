import Link from "next/link";
import { redirect } from "next/navigation";
import { getGnahatumUser } from "@/lib/gnahatum/auth";
import { gnahatumDb } from "@/lib/gnahatum/db";
import { TestImporter } from "@/components/gnahatum/test-importer";

export const dynamic = "force-dynamic";

export default async function ImportTestPage() {
  // The nav hides this from non-LDMs, but hiding a link is not access control.
  const user = await getGnahatumUser();
  if (!user) redirect("/auth/login");
  if (!user.isLdm && user.role !== "admin") redirect("/gnahatum");

  const db = gnahatumDb();

  const [{ data: subjects }, { data: tests }] = await Promise.all([
    db.from("subjects").select("id, name_hy, name_en, sort_order").order("sort_order"),
    db.from("tests").select("subject_id, grade, test_type"),
  ]);

  const existing = new Set(
    ((tests ?? []) as Array<{ subject_id: string; grade: number; test_type: string }>).map(
      (t) => `${t.subject_id}:${t.grade}:${t.test_type}`,
    ),
  );

  const countBySubject = new Map<string, number>();
  for (const t of (tests ?? []) as Array<{ subject_id: string }>) {
    countBySubject.set(t.subject_id, (countBySubject.get(t.subject_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Import a test</h1>
          <Link href="/gnahatum" className="text-sm text-gray-600 hover:text-gray-900">
            ← All tests
          </Link>
        </div>
        <p className="text-gray-600 mt-1">
          Point this at an official test document and it reads the{" "}
          <span className="font-medium">Հավելված 1 · Թեստի բանալի</span> section into an answer key
          you can check and correct before it goes live.
        </p>
      </div>

      <TestImporter
        subjects={(subjects ?? []) as Array<{ id: string; name_hy: string; name_en: string }>}
      />

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">What each subject has so far</h2>
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              {((subjects ?? []) as Array<{ id: string; name_hy: string; name_en: string }>).map(
                (s) => {
                  const n = countBySubject.get(s.id) ?? 0;
                  return (
                    <tr key={s.id} className="border-t first:border-t-0">
                      <td className="px-4 py-2 font-medium text-gray-900">{s.name_hy}</td>
                      <td className="px-4 py-2 text-gray-500">{s.name_en}</td>
                      <td className="px-4 py-2 text-right">
                        {n === 0 ? (
                          <span className="text-gray-400 italic">no tests yet</span>
                        ) : (
                          <span className="text-gray-700">
                            {n} test{n === 1 ? "" : "s"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                },
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Re-importing a subject, grade, type and year that already exists replaces that test&rsquo;s
          answer key in place — existing scans and results keep pointing at it, so correcting a key
          is safe. {existing.size} combination{existing.size === 1 ? "" : "s"} currently stored.
        </p>
      </section>
    </div>
  );
}
