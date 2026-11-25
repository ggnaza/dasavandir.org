import { createAdminClient } from "@/lib/supabase/admin";
import { denyUnlessUser, getAttestationUser, jsonError, loadTest, type AttemptRow } from "@/lib/attestation/server";
import { finalizeAttempt } from "@/lib/attestation/attempts";

export const dynamic = "force-dynamic";

/**
 * Submit the caller's attempt: grade it against the stored key and close it.
 * The response deliberately carries no score — results are staff-only.
 * Allowed after the deadline too, so a timed-out attempt is graded as it stands.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await getAttestationUser();
  const denied = denyUnlessUser(user);
  if (denied) return denied;

  const admin = createAdminClient();
  const { data: row } = await admin.from("attestation_attempts").select("*").eq("id", params.id).maybeSingle();
  const attempt = row as AttemptRow | null;
  if (!attempt || attempt.user_id !== user!.id) return jsonError("Attempt not found", 404);
  if (attempt.status === "submitted") return Response.json({ submitted: true });

  const data = await loadTest(attempt.test_id);
  if (!data) return jsonError("Test not found", 404);

  try {
    await finalizeAttempt(attempt, data.questions);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Could not submit", 500);
  }
  return Response.json({ submitted: true });
}
