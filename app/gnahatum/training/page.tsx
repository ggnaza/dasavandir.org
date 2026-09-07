import { redirect } from "next/navigation";
import { getGnahatumUser } from "@/lib/gnahatum/auth";
import { gnahatumDb } from "@/lib/gnahatum/db";
import { getAvailableModels } from "@/lib/gnahatum/models";
import { GoldSetManager } from "@/components/gnahatum/gold-set-manager";

export const dynamic = "force-dynamic";

interface ModelRow {
  model_id: string;
  used_learning: boolean;
  scans_scored: number;
  mean_abs_delta: number | null;
  item_accuracy_pct: number | null;
  last_run_at: string | null;
}

export default async function TrainingPage() {
  // The nav hides this link from non-LDMs, but hiding a link is not access
  // control — the page enforces it too.
  const user = await getGnahatumUser();
  if (!user) redirect("/auth/login");
  if (!user.isLdm && user.role !== "admin") redirect("/gnahatum");

  const db = gnahatumDb();

  const [{ data: subjects }, { data: tests }, { data: goldScans }, { data: performance }] =
    await Promise.all([
      db.from("subjects").select("id, name_hy, name_en, sort_order").order("sort_order"),
      db
        .from("tests")
        .select("id, subject_id, grade, test_type, year")
        .order("grade"),
      db.from("gold_scans").select("id, test_id"),
      db.from("model_performance").select("*"),
    ]);

  const goldByTest = new Map<string, number>();
  for (const g of (goldScans ?? []) as Array<{ test_id: string }>) {
    goldByTest.set(g.test_id, (goldByTest.get(g.test_id) ?? 0) + 1);
  }

  const rows = ((performance ?? []) as ModelRow[]).sort(
    (a, b) => (a.mean_abs_delta ?? 99) - (b.mean_abs_delta ?? 99),
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Training data</h1>
        <p className="text-gray-600 mt-1">
          Upload tests you have already graded by hand, with the real per-question scores. They
          become the ground truth this module measures every model against — and the source of
          the accepted-answer knowledge it grades with.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 text-sm text-amber-900">
        <p className="font-medium mb-1">Why this is not model training</p>
        <p>
          The scoring models cannot be fine-tuned through their APIs, and a tuned model would be
          thrown away the moment you switched providers. Instead everything learned here is stored
          in the database as plain text against the question it belongs to, and read back into the
          prompt at scoring time. Switch Claude to Gemini tomorrow and none of it is lost.
        </p>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Model accuracy</h2>
        {rows.length === 0 ? (
          <div className="bg-white rounded-lg border p-6 text-center text-gray-500">
            <p>No benchmark runs yet.</p>
            <p className="text-sm mt-1">
              Upload a few human-scored tests below, then run a benchmark to see how each model
              compares.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Model</th>
                  <th className="text-right px-4 py-2 font-medium">Scans</th>
                  <th className="text-right px-4 py-2 font-medium">Avg total error</th>
                  <th className="text-right px-4 py-2 font-medium">Per-question accuracy</th>
                  <th className="text-left px-4 py-2 font-medium">Mode</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.model_id}-${String(r.used_learning)}`} className="border-t">
                    <td className="px-4 py-2 font-medium text-gray-900">{r.model_id}</td>
                    <td className="px-4 py-2 text-right">{r.scans_scored}</td>
                    <td className="px-4 py-2 text-right">
                      {r.mean_abs_delta === null ? "—" : `${r.mean_abs_delta} pts`}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {r.item_accuracy_pct === null ? "—" : `${r.item_accuracy_pct}%`}
                    </td>
                    <td className="px-4 py-2 text-gray-500">
                      {r.used_learning ? "with learned knowledge" : "model only"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-gray-500 mt-2">
          &ldquo;Model only&rdquo; runs are the fair comparison between models. Runs with learned
          knowledge measure the deployed system, but score against gold scans the knowledge may
          have come from, so read them as an upper bound.
        </p>
      </section>

      <GoldSetManager
        subjects={(subjects ?? []) as Array<{ id: string; name_hy: string; name_en: string }>}
        tests={(tests ?? []).map(
          (t: { id: string; subject_id: string; grade: number; test_type: string; year: string }) => ({
            ...t,
            goldCount: goldByTest.get(t.id) ?? 0,
          }),
        )}
        models={getAvailableModels().map((m) => ({ id: m.id, name: m.name }))}
      />
    </div>
  );
}
