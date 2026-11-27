import { createAdminClient } from "@/lib/supabase/admin";
import { denyUnlessManager, getAttestationUser, jsonError, passageInTest, PUBLISHED_LOCKED, readJson, testStatus, zodMessage } from "@/lib/attestation/server";
import { coerceCorrect, questionInputSchema } from "@/lib/attestation/schemas";

export const dynamic = "force-dynamic";

/** Add one question by hand (the path for anything the import could not read). */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getAttestationUser();
  const denied = denyUnlessManager(user);
  if (denied) return denied;

  const parsed = await readJson(req);
  if ("error" in parsed) return parsed.error;
  const input = questionInputSchema.safeParse(parsed.body);
  if (!input.success) return jsonError(zodMessage(input.error), 400);

  let correct;
  try {
    correct = coerceCorrect(input.data.answer_type, input.data.correct);
  } catch (e) {
    return jsonError(`correct: ${zodMessage(e)}`, 400);
  }

  const status = await testStatus(params.id);
  if (!status) return jsonError("Test not found", 404);
  if (status === "published") return jsonError(PUBLISHED_LOCKED, 409);
  if (!(await passageInTest(input.data.passage_id, params.id))) return jsonError("That passage belongs to another test", 400);

  const admin = createAdminClient();
  let position = input.data.position;
  if (position === undefined) {
    const { data: last } = await admin
      .from("attestation_questions")
      .select("position")
      .eq("test_id", params.id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    position = (last?.position ?? -1) + 1;
  }

  const { data, error } = await admin
    .from("attestation_questions")
    .insert({ ...input.data, correct, position, test_id: params.id })
    .select("id")
    .single();
  if (error) return jsonError(error.message, 500);
  return Response.json({ id: data.id });
}
