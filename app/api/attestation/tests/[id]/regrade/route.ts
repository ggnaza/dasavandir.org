import { createAdminClient } from "@/lib/supabase/admin";
import { denyUnlessManager, getAttestationUser, jsonError, loadTest, type AttemptRow } from "@/lib/attestation/server";
import { gradeAttempt, type Response as LearnerResponse } from "@/lib/attestation-core";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Re-grade every submitted attempt against the current key (after a key correction). */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await getAttestationUser();
  const denied = denyUnlessManager(user);
  if (denied) return denied;

  const data = await loadTest(params.id);
  if (!data) return jsonError("Test not found", 404);

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("attestation_attempts")
    .select("*")
    .eq("test_id", params.id)
    .eq("status", "submitted");
  if (error) return jsonError(error.message, 500);

  let changed = 0;
  for (const a of (rows ?? []) as AttemptRow[]) {
    const g = gradeAttempt(data.questions, a.answers as Record<string, LearnerResponse>);
    if (Number(a.score) !== g.score || Number(a.max_score) !== g.maxScore) changed++;
    const { error: upErr } = await admin
      .from("attestation_attempts")
      .update({ item_results: g.items, score: g.score, max_score: g.maxScore, percent: g.percent, updated_at: new Date().toISOString() })
      .eq("id", a.id);
    if (upErr) return jsonError(upErr.message, 500);
  }
  return Response.json({ regraded: (rows ?? []).length, changed });
}
