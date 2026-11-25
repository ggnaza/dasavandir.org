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
