import { getGnahatumUser, requireAuth, requireLdm } from "@/lib/gnahatum/auth";
import { gnahatumDb } from "@/lib/gnahatum/db";
import { POINT_DISTRIBUTION, TOTAL_QUESTIONS } from "@/lib/gnahatum/constants";
import { isOwnedBy } from "@/lib/gnahatum/storage";

interface GoldPayload {
  test_id?: string;
  storage_path?: string;
  student_label?: string | null;
  source_note?: string | null;
  items?: Array<{ question_number: number; human_points: number; note?: string | null }>;
}

/**
 * Record one human-scored test as ground truth.
 *
 * This is the "upload the answer sheets with the real scores" endpoint. The
 * rows it writes are provider-neutral on purpose: they benchmark any model,
 * they mine answer variants, and they would serve as a fine-tuning corpus if
 * that ever became worthwhile. Nothing here is tied to a model.
 */
export async function POST(request: Request) {
  const user = await getGnahatumUser();
  const denied = requireAuth(user);
  if (denied) return denied;

  // Ground truth steers every future score, so writing it is not a
  // rank-and-file teacher action.
  const forbidden = requireLdm(user!);
  if (forbidden) return forbidden;

  let body: GoldPayload;
  try {
    body = (await request.json()) as GoldPayload;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { test_id: testId, storage_path: storagePath, items } = body;

  if (!testId || !storagePath || !items?.length) {
    return Response.json(
      { error: "test_id, storage_path and items are required" },
      { status: 400 },
    );
  }

  // Same rule as the scoring route: the path arrives from the client, so
  // ownership has to be re-checked here or a caller could attach someone
  // else's scan to their own gold record.
  if (!isOwnedBy(storagePath, user!.id)) {
    return Response.json({ error: "Not your upload" }, { status: 403 });
  }

  const seen = new Set<number>();
  for (const item of items) {
    const n = item.question_number;
    if (!Number.isInteger(n) || n < 1 || n > TOTAL_QUESTIONS) {
      return Response.json(
        { error: `question_number must be 1-${TOTAL_QUESTIONS} (got ${n})` },
        { status: 400 },
      );
    }
    if (seen.has(n)) {
      return Response.json({ error: `Duplicate score for question ${n}` }, { status: 400 });
    }
    seen.add(n);

    const max = POINT_DISTRIBUTION[n] ?? 0;
    if (typeof item.human_points !== "number" || Number.isNaN(item.human_points)) {
      return Response.json({ error: `Q${n}: score must be a number` }, { status: 400 });
    }
    if (item.human_points < 0 || item.human_points > max) {
      return Response.json(
        { error: `Q${n}: score must be between 0 and ${max}` },
        { status: 400 },
      );
    }
  }

  const db = gnahatumDb();

  const { data: test, error: testErr } = await db
    .from("tests")
    .select("id")
    .eq("id", testId)
    .single();

  if (testErr || !test) {
    return Response.json({ error: "Test not found" }, { status: 404 });
  }

  const humanTotal = items.reduce((sum, i) => sum + i.human_points, 0);

  const { data: goldScan, error: goldErr } = await db
    .from("gold_scans")
    .insert({
      test_id: testId,
      file_path: storagePath,
      student_label: body.student_label ?? null,
      source_note: body.source_note ?? null,
      human_total: humanTotal,
      graded_by: user!.id,
    })
    .select("id")
    .single();

  if (goldErr || !goldScan) {
    console.error("[gnahatum/training/gold] insert failed", goldErr?.message);
    return Response.json({ error: "Could not save the gold scan" }, { status: 500 });
  }

  const { error: itemsErr } = await db.from("gold_items").insert(
    items.map((i) => ({
      gold_scan_id: goldScan.id,
      question_number: i.question_number,
      human_points: i.human_points,
      note: i.note ?? null,
    })),
  );

  if (itemsErr) {
    // Without its items the parent row is a total with no breakdown, which
    // would silently skew every benchmark. Roll it back rather than keep it.
    await db.from("gold_scans").delete().eq("id", goldScan.id);
    console.error("[gnahatum/training/gold] items insert failed", itemsErr.message);
    return Response.json({ error: "Could not save the per-question scores" }, { status: 500 });
  }

  return Response.json({ id: goldScan.id, human_total: humanTotal, items: items.length });
}
