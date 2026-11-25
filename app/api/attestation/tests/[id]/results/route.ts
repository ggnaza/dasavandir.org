import { createAdminClient } from "@/lib/supabase/admin";
import { denyUnlessManager, getAttestationUser, jsonError, type AttemptRow } from "@/lib/attestation/server";

export const dynamic = "force-dynamic";

/** Every attempt at a test, with the taker's name — managers only. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getAttestationUser();
  const denied = denyUnlessManager(user);
  if (denied) return denied;

  const admin = createAdminClient();
  const { data: attempts, error } = await admin
    .from("attestation_attempts")
    .select("*")
    .eq("test_id", params.id)
    .order("submitted_at", { ascending: false, nullsFirst: false });
  if (error) return jsonError(error.message, 500);

  const rows = (attempts ?? []) as AttemptRow[];
  const userIds = Array.from(new Set(rows.map((a) => a.user_id)));
  const { data: profiles } = userIds.length
    ? await admin.from("profiles").select("id, full_name, email").in("id", userIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  return Response.json({
    attempts: rows.map((a) => ({
      ...a,
      full_name: byId.get(a.user_id)?.full_name ?? null,
      email: byId.get(a.user_id)?.email ?? null,
    })),
  });
}
