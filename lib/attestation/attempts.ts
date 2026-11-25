/**
 * Taking a test: start/resume, deadlines, grading on submit. Server only.
 *
 * A teacher's view of a question never includes `correct`, `needs_review` or
 * `review_note`, and a teacher never receives a score (ADR-0010).
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { gradeAttempt, type Response as LearnerResponse } from "@/lib/attestation-core";
import type { AttemptRow, QuestionRow, TestRow } from "@/lib/attestation/server";

/** Seconds of slack after the deadline for an in-flight save or submit. */
export const GRACE_SECONDS = 60;

export type PublicQuestion = Omit<QuestionRow, "correct" | "needs_review" | "review_note" | "points" | "scoring">;

export function toPublicQuestion(q: QuestionRow): PublicQuestion {
  const { correct: _c, needs_review: _n, review_note: _r, points: _p, scoring: _s, ...rest } = q;
  return rest;
}

export function deadlineOf(attempt: Pick<AttemptRow, "started_at">, test: Pick<TestRow, "time_limit_minutes">): Date | null {
  if (!test.time_limit_minutes) return null;
  return new Date(new Date(attempt.started_at).getTime() + test.time_limit_minutes * 60_000);
}

export function isExpired(deadline: Date | null, now = Date.now()): boolean {
  return deadline !== null && now > deadline.getTime() + GRACE_SECONDS * 1000;
}

/** Grade and close an attempt. Idempotent: an already-submitted attempt is left alone. */
export async function finalizeAttempt(attempt: AttemptRow, questions: QuestionRow[]): Promise<void> {
  if (attempt.status === "submitted") return;
  const g = gradeAttempt(questions, attempt.answers as Record<string, LearnerResponse>);
  const admin = createAdminClient();
  const { error } = await admin
    .from("attestation_attempts")
    .update({
      status: "submitted",
      item_results: g.items,
      score: g.score,
      max_score: g.maxScore,
      percent: g.percent,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", attempt.id)
    .eq("status", "in_progress");
  if (error) throw new Error(`Could not submit attempt: ${error.message}`, { cause: error });
}

export interface TakeState {
  state: "in_progress" | "done";
  attemptId: string | null;
  answers: Record<string, unknown>;
  startedAt: string | null;
  deadline: string | null;
  submittedCount: number;
}

/**
 * Resume the open attempt, or open a new one if attempts remain. An open attempt
 * whose time ran out is submitted as it stands first.
 */
export async function startOrResume(userId: string, test: TestRow, questions: QuestionRow[]): Promise<TakeState> {
  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("attestation_attempts")
    .select("*")
    .eq("test_id", test.id)
    .eq("user_id", userId);
  if (error) throw new Error(error.message, { cause: error });
  const attempts = (rows ?? []) as AttemptRow[];

  let open = attempts.find((a) => a.status === "in_progress") ?? null;
  let submittedCount = attempts.filter((a) => a.status === "submitted").length;

  if (open && isExpired(deadlineOf(open, test))) {
    await finalizeAttempt(open, questions);
    open = null;
    submittedCount++;
  }

  if (!open) {
    if (submittedCount >= test.max_attempts) {
      return { state: "done", attemptId: null, answers: {}, startedAt: null, deadline: null, submittedCount };
    }
    const { data: created, error: insErr } = await admin
      .from("attestation_attempts")
      .insert({ test_id: test.id, user_id: userId })
      .select("*")
      .single();
    if (insErr) {
      // Two tabs racing: the unique open-attempt index rejected the second insert.
      const { data: again } = await admin
        .from("attestation_attempts")
        .select("*")
        .eq("test_id", test.id)
        .eq("user_id", userId)
        .eq("status", "in_progress")
        .maybeSingle();
      if (!again) throw new Error(insErr.message, { cause: insErr });
      open = again as AttemptRow;
    } else {
      open = created as AttemptRow;
    }
  }

  const deadline = deadlineOf(open, test);
  return {
    state: "in_progress",
    attemptId: open.id,
    answers: open.answers ?? {},
    startedAt: open.started_at,
    deadline: deadline ? deadline.toISOString() : null,
    submittedCount,
  };
}

/**
 * Validate a learner's answers against the test's question types and merge them
 * into the open attempt atomically (one UPDATE in Postgres). Null clears an answer.
 * Returns false when the attempt is no longer open.
 */
export async function mergeAnswers(
  attemptId: string,
  userId: string,
  questions: Pick<QuestionRow, "id" | "answer_type">[],
  answers: Record<string, unknown>,
  coerce: (type: QuestionRow["answer_type"], value: unknown) => unknown,
): Promise<boolean> {
  const types = new Map(questions.map((q) => [q.id, q.answer_type]));
  const patch: Record<string, unknown> = {};
  const remove: string[] = [];
  for (const qid of Object.keys(answers)) {
    const type = types.get(qid);
    if (!type) throw new AnswerError("Unknown question");
    const v = coerce(type, answers[qid]);
    if (v === null) remove.push(qid);
    else patch[qid] = v;
  }
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("attestation_merge_answers", {
    p_attempt: attemptId,
    p_user: userId,
    p_patch: patch,
    p_remove: remove,
  });
  if (error) throw new Error(error.message, { cause: error });
  return data === true;
}

/** A learner sent an answer that does not fit the question. */
export class AnswerError extends Error {
  readonly kind = "answer";
}

/**
 * Submit, as it stands, every open attempt whose time ran out — so a teacher who
 * closed the tab still gets a result. Called before results or the home list are read.
 */
export async function finalizeExpired(testIds: string[]): Promise<void> {
  if (testIds.length === 0) return;
  const admin = createAdminClient();
  const [{ data: tests }, { data: open }] = await Promise.all([
    admin.from("attestation_tests").select("id, time_limit_minutes").in("id", testIds).not("time_limit_minutes", "is", null),
    admin.from("attestation_attempts").select("*").in("test_id", testIds).eq("status", "in_progress"),
  ]);
  const limits = new Map((tests ?? []).map((t) => [t.id as string, t as Pick<TestRow, "time_limit_minutes">]));
  const expired = ((open ?? []) as AttemptRow[]).filter((a) => {
    const t = limits.get(a.test_id);
    return t ? isExpired(deadlineOf(a, t)) : false;
  });
  const byTest = new Map<string, QuestionRow[]>();
  for (const a of expired) {
    if (!byTest.has(a.test_id)) {
      const { data } = await admin.from("attestation_questions").select("*").eq("test_id", a.test_id);
      byTest.set(a.test_id, (data ?? []) as QuestionRow[]);
    }
    await finalizeAttempt(a, byTest.get(a.test_id) ?? []);
  }
}
