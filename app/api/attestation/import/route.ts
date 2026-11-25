import { createAdminClient } from "@/lib/supabase/admin";
import { denyUnlessManager, getAttestationUser, jsonError, readJson, zodMessage } from "@/lib/attestation/server";
import { bundleSchema, coerceCorrect } from "@/lib/attestation/schemas";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Create a whole draft test from a JSON bundle (test + passages + questions).
 *
 * The bundle is produced offline from the recreatability audit and reviewed; it is
 * not committed to git because it is the full test content. The test is created as
 * a draft — it cannot be published until every needs_review item is resolved.
 */
export async function POST(req: Request) {
  const user = await getAttestationUser();
  const denied = denyUnlessManager(user);
  if (denied) return denied;

  const parsed = await readJson(req);
  if ("error" in parsed) return parsed.error;
  const input = bundleSchema.safeParse(parsed.body);
  if (!input.success) return jsonError(zodMessage(input.error), 400);
  const bundle = input.data;

  const numbers = bundle.questions.map((q) => q.number);
  const dup = numbers.find((n, i) => numbers.indexOf(n) !== i);
  if (dup) return jsonError(`Question number ${dup} appears twice`, 400);
  const passageKeys = new Set(bundle.passages.map((p) => p.key));
  const badRef = bundle.questions.find((q) => q.passage_key && !passageKeys.has(q.passage_key));
  if (badRef) return jsonError(`Q${badRef.number} points at unknown passage "${badRef.passage_key}"`, 400);

  const rows = [];
  for (let i = 0; i < bundle.questions.length; i++) {
    const q = bundle.questions[i]!;
    try {
      rows.push({ ...q, correct: coerceCorrect(q.answer_type, q.correct), position: q.position ?? i });
    } catch (e) {
      return jsonError(`Q${q.number} correct: ${zodMessage(e)}`, 400);
    }
  }

  const admin = createAdminClient();
  const { data: test, error: testErr } = await admin
    .from("attestation_tests")
    .insert({ ...bundle.test, status: "draft", created_by: user!.id })
    .select("id")
    .single();
  if (testErr) return jsonError(testErr.message, 500);

  // From here a failure removes the half-built test, so an import is all or nothing.
  const fail = async (message: string) => {
    await admin.from("attestation_tests").delete().eq("id", test.id);
    return jsonError(message, 500);
  };

  const passageIds = new Map<string, string>();
  if (bundle.passages.length) {
    const { data: inserted, error } = await admin
      .from("attestation_passages")
      .insert(bundle.passages.map(({ key: _key, ...p }, i) => ({ ...p, position: p.position ?? i, test_id: test.id })))
      .select("id, position");
    if (error || !inserted) return fail(error?.message ?? "Could not save passages");
    const byPos = new Map(inserted.map((r) => [r.position, r.id]));
    bundle.passages.forEach((p, i) => {
      const id = byPos.get(p.position ?? i);
      if (id) passageIds.set(p.key, id);
    });
  }

  const { error: qErr } = await admin.from("attestation_questions").insert(
    rows.map(({ passage_key, ...q }) => ({
      ...q,
      test_id: test.id,
      passage_id: passage_key ? passageIds.get(passage_key) ?? null : null,
    })),
  );
  if (qErr) return fail(qErr.message);

  return Response.json({ id: test.id, questions: rows.length, passages: bundle.passages.length });
}
