import { createAdminClient } from "@/lib/supabase/admin";
import { denyUnlessManager, getAttestationUser, jsonError, readJson, zodMessage } from "@/lib/attestation/server";
import { passageInputSchema } from "@/lib/attestation/schemas";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getAttestationUser();
  const denied = denyUnlessManager(user);
  if (denied) return denied;

  const parsed = await readJson(req);
  if ("error" in parsed) return parsed.error;
  const input = passageInputSchema.safeParse(parsed.body);
  if (!input.success) return jsonError(zodMessage(input.error), 400);

  const admin = createAdminClient();
  const { error } = await admin.from("attestation_passages").update(input.data).eq("id", params.id);
  if (error) return jsonError(error.message, 500);
  return Response.json({ ok: true });
}

/** Questions that used this passage keep existing; their passage_id is set null by the FK. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getAttestationUser();
  const denied = denyUnlessManager(user);
  if (denied) return denied;

  const admin = createAdminClient();
  const { error } = await admin.from("attestation_passages").delete().eq("id", params.id);
  if (error) return jsonError(error.message, 500);
  return Response.json({ ok: true });
}
