import { createAdminClient } from "@/lib/supabase/admin";
import { denyUnlessManager, getAttestationUser, jsonError, readJson, zodMessage } from "@/lib/attestation/server";
import { passageInputSchema } from "@/lib/attestation/schemas";

export const dynamic = "force-dynamic";

/** Add a shared passage / setup that several questions point at. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getAttestationUser();
  const denied = denyUnlessManager(user);
  if (denied) return denied;

  const parsed = await readJson(req);
  if ("error" in parsed) return parsed.error;
  const input = passageInputSchema.safeParse(parsed.body);
  if (!input.success) return jsonError(zodMessage(input.error), 400);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("attestation_passages")
    .insert({ ...input.data, test_id: params.id })
    .select("id")
    .single();
  if (error) return jsonError(error.message, 500);
  return Response.json({ id: data.id });
}
