import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  denyUnlessUser,
  getAttestationUser,
  jsonError,
  mayTakeTest,
  loadTest,
  zodMessage,
  type AttemptRow,
} from "@/lib/attestation/server";
import { coerceResponse } from "@/lib/attestation/schemas";
import { AnswerError, deadlineOf, finalizeAttempt, isExpired, mergeAnswers } from "@/lib/attestation/attempts";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ answers: z.record(z.string().uuid(), z.unknown()).optional() }).optional();

/**
 * Submit the caller's attempt: grade it against the stored key and close it.
 *
 * The client sends its full answer set with the submit, merged before grading,
 * so an autosave still in flight (or one that failed) cannot cost the teacher an
 * answer. After the deadline the late answers are ignored and the attempt is graded
 * as stored. The response carries no score — results are staff-only.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getAttestationUser();
  const denied = denyUnlessUser(user);
  if (denied) return denied;

  let answers: Record<string, unknown> | undefined;
  const raw = await req.text();
  if (raw.trim()) {
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return jsonError("Invalid JSON body", 400);
    }
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return jsonError(zodMessage(parsed.error), 400);
    answers = parsed.data?.answers;
  }

  const admin = createAdminClient();
  const { data: row } = await admin.from("attestation_attempts").select("*").eq("id", params.id).maybeSingle();
  let attempt = row as AttemptRow | null;
  if (!attempt || attempt.user_id !== user!.id) return jsonError("Attempt not found", 404);
  if (attempt.status === "submitted") return Response.json({ submitted: true });

  const data = await loadTest(attempt.test_id);
  if (!data) return jsonError("Test not found", 404);
  // A withdrawn invitation stops the attempt where it is (a manager can re-invite to resume).
  if (!(await mayTakeTest(user!, attempt.test_id))) return jsonError("You are no longer invited to this test", 403);

  if (answers && !isExpired(deadlineOf(attempt))) {
    try {
      await mergeAnswers(attempt.id, user!.id, data.questions, answers, coerceResponse);
    } catch (e) {
      if (e instanceof AnswerError) return jsonError(e.message, 400);
      if (e && typeof e === "object" && "issues" in e) return jsonError(zodMessage(e), 400);
      return jsonError(e instanceof Error ? e.message : "Could not save answers", 500);
    }
    const { data: fresh } = await admin.from("attestation_attempts").select("*").eq("id", attempt.id).single();
    attempt = (fresh as AttemptRow | null) ?? attempt;
  }

  try {
    await finalizeAttempt(attempt, data.questions);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Could not submit", 500);
  }
  return Response.json({ submitted: true });
}
