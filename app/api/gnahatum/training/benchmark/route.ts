import { getGnahatumUser, requireAuth, requireLdm } from "@/lib/gnahatum/auth";
import { gnahatumDb } from "@/lib/gnahatum/db";
import { createAdminClient } from "@/lib/supabase/admin";
import { scoreFromScan } from "@/lib/gnahatum/scorer";
import { SCORING_MODELS } from "@/lib/gnahatum/models";
import { fetchLearnedKnowledge, formatLearnedKnowledge } from "@/lib/gnahatum/learning";
import type { AnswerKeyItem } from "@/lib/gnahatum/constants";
import { SCAN_BUCKET, MAX_SCAN_BYTES, isAllowedScanType } from "@/lib/gnahatum/storage";

export const maxDuration = 300;

/**
 * A benchmark run scores N gold scans, which is N model calls and therefore
 * real money. Cap it so a mistyped limit cannot bill for a thousand scans.
 */
const MAX_SCANS_PER_RUN = 40;
const DEFAULT_SCANS_PER_RUN = 10;

interface BenchmarkPayload {
  model_id?: string;
  test_id?: string | null;
  limit?: number;
  /**
   * Off by default and that matters: knowledge mined from these same gold
   * scans would leak the answers back into the measurement. Turn it on only
   * to measure the deployed system end-to-end, not to compare models.
   */
  include_learning?: boolean;
}

export async function POST(request: Request) {
  const user = await getGnahatumUser();
  const denied = requireAuth(user);
  if (denied) return denied;

  const forbidden = requireLdm(user!);
  if (forbidden) return forbidden;

  let body: BenchmarkPayload;
  try {
    body = (await request.json()) as BenchmarkPayload;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const model = SCORING_MODELS.find((m) => m.id === body.model_id);
  if (!model) {
    return Response.json({ error: `Unknown model: ${body.model_id}` }, { status: 400 });
  }

  const includeLearning = body.include_learning === true;
  const limit = Math.min(
    Math.max(Number(body.limit) || DEFAULT_SCANS_PER_RUN, 1),
    MAX_SCANS_PER_RUN,
  );

  const db = gnahatumDb();

  let query = db
    .from("gold_scans")
    .select("id, test_id, file_path, human_total, gold_items(question_number, human_points)")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (body.test_id) query = query.eq("test_id", body.test_id);

  const { data: goldScans, error: goldErr } = await query;

  if (goldErr) {
    console.error("[gnahatum/training/benchmark] could not load gold set", goldErr.message);
    return Response.json({ error: "Could not load the gold set" }, { status: 500 });
  }

  if (!goldScans?.length) {
    return Response.json(
      { error: "No gold scans to benchmark — upload human-scored tests first" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const runBatch = crypto.randomUUID();

  // Answer keys and learned knowledge are per test, and a batch usually spans
  // only a handful of tests — cache them so a 40-scan run does not refetch the
  // same key 40 times.
  const testCache = new Map<string, { answerKey: AnswerKeyItem[]; notes: string | null; learned: string }>();

  async function contextFor(testId: string) {
    const cached = testCache.get(testId);
    if (cached) return cached;

    const { data: test } = await db
      .from("tests")
      .select("answer_key, scoring_notes")
      .eq("id", testId)
      .single();

    const answerKey = (test?.answer_key ?? []) as AnswerKeyItem[];
    let learned = "";
    if (includeLearning) {
      learned = formatLearnedKnowledge(await fetchLearnedKnowledge(testId), answerKey);
    }

    const entry = { answerKey, notes: test?.scoring_notes ?? null, learned };
    testCache.set(testId, entry);
    return entry;
  }

  const rows: Array<Record<string, unknown>> = [];
  let scored = 0;
  let failed = 0;

  for (const gold of goldScans) {
    const humanPoints = new Map<number, number>(
      ((gold.gold_items ?? []) as Array<{ question_number: number; human_points: number }>).map(
        (i) => [i.question_number, Number(i.human_points)],
      ),
    );

    try {
      const { data: blob, error: downloadErr } = await admin.storage
        .from(SCAN_BUCKET)
        .download(gold.file_path);

      if (downloadErr || !blob) {
        throw new Error(downloadErr?.message ?? "scan not found in storage");
      }
      if (blob.size > MAX_SCAN_BYTES) {
        throw new Error("scan is too large to score");
      }
      if (!isAllowedScanType(blob.type)) {
        throw new Error(`unsupported file type: ${blob.type}`);
      }

      const ctx = await contextFor(gold.test_id);
      if (!ctx.answerKey.length) {
        throw new Error("test has no answer key configured");
      }

      const base64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
      const result = await scoreFromScan(
        base64,
        blob.type,
        ctx.answerKey,
        ctx.notes,
        model.id,
        ctx.learned || undefined,
      );

      // Per-question agreement is the number that actually matters. Two tests
      // can both land on 11/15 while disagreeing on every single question.
      let matched = 0;
      for (const item of result.items) {
        const human = humanPoints.get(item.number);
        if (human !== undefined && Math.abs(human - item.awarded_points) < 0.01) matched += 1;
      }

      rows.push({
        run_batch: runBatch,
        model_id: model.id,
        model_provider: model.provider,
        gold_scan_id: gold.id,
        ai_total: result.totalScore,
        ai_items: result.items,
        human_total: gold.human_total,
        items_matched: matched,
        items_total: humanPoints.size,
        used_learning: includeLearning,
      });
      scored += 1;
    } catch (err) {
      rows.push({
        run_batch: runBatch,
        model_id: model.id,
        model_provider: model.provider,
        gold_scan_id: gold.id,
        ai_total: null,
        ai_items: [],
        human_total: gold.human_total,
        used_learning: includeLearning,
        error_text: err instanceof Error ? err.message : "scoring failed",
      });
      failed += 1;
    }
  }

  const { error: insertErr } = await db.from("benchmark_runs").insert(rows);
  if (insertErr) {
    console.error("[gnahatum/training/benchmark] could not save runs", insertErr.message);
    return Response.json({ error: "Scored, but could not save the results" }, { status: 500 });
  }

  const successful = rows.filter((r) => !r.error_text);
  const meanAbsDelta =
    successful.length > 0
      ? successful.reduce(
          (sum, r) => sum + Math.abs((r.ai_total as number) - (r.human_total as number)),
          0,
        ) / successful.length
      : null;
  const itemsMatched = successful.reduce((s, r) => s + ((r.items_matched as number) ?? 0), 0);
  const itemsTotal = successful.reduce((s, r) => s + ((r.items_total as number) ?? 0), 0);

  return Response.json({
    run_batch: runBatch,
    model_id: model.id,
    scored,
    failed,
    used_learning: includeLearning,
    mean_abs_delta: meanAbsDelta === null ? null : Number(meanAbsDelta.toFixed(3)),
    item_accuracy_pct: itemsTotal > 0 ? Number(((100 * itemsMatched) / itemsTotal).toFixed(1)) : null,
  });
}
