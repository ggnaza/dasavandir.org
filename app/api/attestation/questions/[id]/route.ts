import { createAdminClient } from "@/lib/supabase/admin";
import { denyUnlessManager, getAttestationUser, jsonError, readJson, zodMessage } from "@/lib/attestation/server";
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

  const admin = createAdminClient();
  const { error } = await admin.from("attestation_questions").delete().eq("id", params.id);
  if (error) return jsonError(error.message, 500);
  return Response.json({ ok: true });
}
