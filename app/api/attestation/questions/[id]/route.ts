import { createAdminClient } from "@/lib/supabase/admin";
import {
  denyUnlessManager,
  getAttestationUser,
  jsonError,
  passageInTest,
  PUBLISHED_LOCKED,
  readJson,
  testOfQuestion,
  zodMessage,
} from "@/lib/attestation/server";
import { validateCorrect } from "@/lib/attestation-core";
import { coerceCorrect, questionInputSchema } from "@/lib/attestation/schemas";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
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

  const owner = await testOfQuestion(params.id);
  if (!owner) return jsonError("Question not found", 404);
  if (!(await passageInTest(input.data.passage_id, owner.test_id))) return jsonError("That passage belongs to another test", 400);
  if (owner.status === "published") {
    // Takers may already hold answers to this question: its shape must not change,
    // and it must stay gradable. A key fix is allowed — then regrade from Results.
    if (input.data.answer_type !== owner.question.answer_type) return jsonError(PUBLISHED_LOCKED, 409);
    const problems = validateCorrect({ ...input.data, correct });
    if (input.data.needs_review) problems.push('cannot be marked "needs review" while published');
    if (problems.length) return jsonError(`Published test: ${problems.join("; ")}`, 409);
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("attestation_questions")
    .update({ ...input.data, correct, updated_at: new Date().toISOString() })
    .eq("id", params.id);
  if (error) return jsonError(error.message, 500);
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getAttestationUser();
  const denied = denyUnlessManager(user);
  if (denied) return denied;

  const owner = await testOfQuestion(params.id);
  if (!owner) return jsonError("Question not found", 404);
  if (owner.status === "published") return jsonError(PUBLISHED_LOCKED, 409);

  const admin = createAdminClient();
  const { error } = await admin.from("attestation_questions").delete().eq("id", params.id);
  if (error) return jsonError(error.message, 500);
  return Response.json({ ok: true });
}
