import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  denyUnlessManager,
  denyUnlessUser,
  getAttestationUser,
  jsonError,
  mayTakeTest,
  loadTest,
  readJson,
  zodMessage,
  type AttemptRow,
} from "@/lib/attestation/server";
import { coerceResponse } from "@/lib/attestation/schemas";
import { AnswerError, deadlineOf, isExpired, mergeAnswers } from "@/lib/attestation/attempts";

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
  // A withdrawn invitation stops the attempt where it is (a manager can re-invite to resume).
  if (!(await mayTakeTest(user!, attempt.test_id))) return jsonError("You are no longer invited to this test", 403);
  if (isExpired(deadlineOf(attempt))) return jsonError("Time is up", 409);

  // Merged in one UPDATE inside Postgres, so overlapping saves cannot drop each other's answers.
  let ok: boolean;
  try {
    ok = await mergeAnswers(attempt.id, user!.id, data.questions, input.data.answers, coerceResponse);
  } catch (e) {
    if (e instanceof AnswerError) return jsonError(e.message, 400);
    if (e && typeof e === "object" && "issues" in e) return jsonError(zodMessage(e), 400);
    return jsonError(e instanceof Error ? e.message : "Save failed", 500);
  }
  if (!ok) return jsonError("This attempt is already submitted", 409);
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
