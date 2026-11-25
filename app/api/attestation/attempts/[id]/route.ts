import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  denyUnlessManager,
  denyUnlessUser,
  getAttestationUser,
  jsonError,
  loadTest,
  readJson,
  zodMessage,
  type AttemptRow,
} from "@/lib/attestation/server";
import { coerceResponse } from "@/lib/attestation/schemas";
import { deadlineOf, isExpired } from "@/lib/attestation/attempts";

export const dynamic = "force-dynamic";

const saveSchema = z.object({ answers: z.record(z.string().uuid(), z.unknown()) });

/** Autosave: merge the given answers into the caller's open attempt. */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getAttestationUser();
  const denied = denyUnlessUser(user);
  if (denied) return denied;

  const parsed = await readJson(req);
  if ("error" in parsed) return parsed.error;
  const input = saveSchema.safeParse(parsed.body);
  if (!input.success) return jsonError(zodMessage(input.error), 400);

  const admin = createAdminClient();
  const { data: row } = await admin.from("attestation_attempts").select("*").eq("id", params.id).maybeSingle();
  const attempt = row as AttemptRow | null;
  if (!attempt || attempt.user_id !== user!.id) return jsonError("Attempt not found", 404);
  if (attempt.status !== "in_progress") return jsonError("This attempt is already submitted", 409);

  const data = await loadTest(attempt.test_id);
  if (!data) return jsonError("Test not found", 404);
  if (isExpired(deadlineOf(attempt, data.test))) return jsonError("Time is up", 409);

  const types = new Map(data.questions.map((q) => [q.id, q.answer_type]));
  const merged: Record<string, unknown> = { ...(attempt.answers ?? {}) };
  for (const [qid, value] of Object.entries(input.data.answers)) {
    const type = types.get(qid);
    if (!type) return jsonError("Unknown question", 400);
    try {
      const v = coerceResponse(type, value);
      if (v === null) delete merged[qid];
      else merged[qid] = v;
    } catch (e) {
      return jsonError(zodMessage(e), 400);
    }
  }

  const { error } = await admin
    .from("attestation_attempts")
    .update({ answers: merged, updated_at: new Date().toISOString() })
    .eq("id", attempt.id)
    .eq("status", "in_progress");
  if (error) return jsonError(error.message, 500);
  return Response.json({ ok: true });
}

/** Manager reset: delete one attempt so the teacher can take the test again. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getAttestationUser();
  const denied = denyUnlessManager(user);
  if (denied) return denied;

  const admin = createAdminClient();
  const { error } = await admin.from("attestation_attempts").delete().eq("id", params.id);
  if (error) return jsonError(error.message, 500);
  return Response.json({ ok: true });
}
