import { getGnahatumUser, requireAuth, requireLdm } from "@/lib/gnahatum/auth";
import { gnahatumDb } from "@/lib/gnahatum/db";
import { recordGoldComparisonAsKnowledge } from "@/lib/gnahatum/learning";
import type { ScoredItem } from "@/lib/gnahatum/constants";

/**
 * Turn a finished benchmark batch into durable knowledge.
 *
 * Deliberately a separate, explicit step rather than something the benchmark
 * does on its own: mining a batch into `answer_variants` and then benchmarking
 * against the same gold scans would measure the answers we just handed over.
 * Run the comparison first, look at it, then promote.
 */
export async function POST(request: Request) {
  const user = await getGnahatumUser();
  const denied = requireAuth(user);
  if (denied) return denied;

  const forbidden = requireLdm(user!);
  if (forbidden) return forbidden;

  let body: { run_batch?: string };
  try {
    body = (await request.json()) as { run_batch?: string };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.run_batch) {
    return Response.json({ error: "run_batch is required" }, { status: 400 });
  }

  const db = gnahatumDb();

  const { data: runs, error } = await db
    .from("benchmark_runs")
    .select("gold_scan_id, ai_items, gold_scans(test_id, gold_items(question_number, human_points))")
    .eq("run_batch", body.run_batch)
    .is("error_text", null);

  if (error) {
    console.error("[gnahatum/training/promote] could not load run", error.message);
    return Response.json({ error: "Could not load that benchmark run" }, { status: 500 });
  }

  if (!runs?.length) {
    return Response.json({ error: "No successful runs in that batch" }, { status: 404 });
  }

  let learned = 0;

  for (const run of runs) {
    const gold = run.gold_scans as {
      test_id: string;
      gold_items: Array<{ question_number: number; human_points: number }>;
    } | null;

    if (!gold?.test_id) continue;

    const humanPoints = new Map<number, number>(
      (gold.gold_items ?? []).map((i) => [i.question_number, Number(i.human_points)]),
    );

    learned += await recordGoldComparisonAsKnowledge({
      testId: gold.test_id,
      gradedBy: user!.id,
      aiItems: (run.ai_items ?? []) as ScoredItem[],
      humanPoints,
    });
  }

  return Response.json({ run_batch: body.run_batch, variants_learned: learned });
}
