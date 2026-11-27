import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  denyUnlessManager,
  getAttestationUser,
  jsonError,
  loadTest,
  publishBlockers,
  readJson,
  signFigures,
  zodMessage,
} from "@/lib/attestation/server";
import { testInputSchema } from "@/lib/attestation/schemas";
import { validateCorrect } from "@/lib/attestation-core";

export const dynamic = "force-dynamic";

/** Full test for the editor, including correct answers and signed figure URLs. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getAttestationUser();
  const denied = denyUnlessManager(user);
  if (denied) return denied;

  const data = await loadTest(params.id);
  if (!data) return jsonError("Test not found", 404);
  const figures = await signFigures([
    ...data.questions.map((q) => q.image_path),
    ...data.passages.map((p) => p.image_path),
  ]);
  return Response.json({ ...data, figures, blockers: publishBlockers(data.questions, validateCorrect) });
}

const patchSchema = testInputSchema.partial().extend({
  status: z.enum(["draft", "published", "archived"]).optional(),
});

/** Edit metadata, or change status. Publishing is refused while anything blocks it. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getAttestationUser();
  const denied = denyUnlessManager(user);
  if (denied) return denied;

  const parsed = await readJson(req);
  if ("error" in parsed) return parsed.error;
  const input = patchSchema.safeParse(parsed.body);
  if (!input.success) return jsonError(zodMessage(input.error), 400);

  if (input.data.status === "published") {
    const data = await loadTest(params.id);
    if (!data) return jsonError("Test not found", 404);
    const blockers = publishBlockers(data.questions, validateCorrect);
    if (blockers.length) return Response.json({ error: "Cannot publish yet", blockers }, { status: 409 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("attestation_tests")
    .update({ ...input.data, updated_at: new Date().toISOString() })
    .eq("id", params.id);
  if (error) return jsonError(error.message, 500);
  return Response.json({ ok: true });
}

/** Delete a test. Refused once anyone has submitted it — archive it instead. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getAttestationUser();
  const denied = denyUnlessManager(user);
  if (denied) return denied;

  const admin = createAdminClient();
  const { count } = await admin
    .from("attestation_attempts")
    .select("id", { count: "exact", head: true })
    .eq("test_id", params.id)
    .eq("status", "submitted");
  if ((count ?? 0) > 0) return jsonError("This test has submitted attempts. Archive it instead of deleting.", 409);

  const { error } = await admin.from("attestation_tests").delete().eq("id", params.id);
  if (error) return jsonError(error.message, 500);
  return Response.json({ ok: true });
}
