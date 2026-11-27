/**
 * Server-side access + data helpers for the attestation module (ADR-0010).
 *
 * Every table has RLS on with no client policies, so all reads go through the
 * service-role client here, after the module_access check. Correct answers and
 * results must never reach a non-manager.
 */
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getModuleGrants } from "@/lib/access/module-access";
import type { AnswerType, Choice, Correct, ScoringMode } from "@/lib/attestation-core";

export const FIGURE_BUCKET = "attestation";

export interface AttestationUser {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  /** Builds tests and sees results: platform admin, or `ldm` in the attestation module. */
  isManager: boolean;
}

/** The signed-in user if they may enter the attestation module, else null. */
export async function getAttestationUser(): Promise<AttestationUser | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Own-profile reads go through the service role (CLAUDE.md: RLS on profiles).
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (!profile) return null;

  const grants = await getModuleGrants(user.id, profile.role);
  if (grants.attestation === "none") return null;

  return {
    id: user.id,
    email: user.email ?? "",
    fullName: profile.full_name ?? null,
    role: profile.role,
    isManager: profile.role === "admin" || grants.attestation === "ldm",
  };
}

export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

/** 401/403 response, or null when the user may proceed. */
export function denyUnlessUser(user: AttestationUser | null): Response | null {
  return user ? null : jsonError("Unauthorized", 401);
}

export function denyUnlessManager(user: AttestationUser | null): Response | null {
  if (!user) return jsonError("Unauthorized", 401);
  if (!user.isManager) return jsonError("Forbidden", 403);
  return null;
}

export interface TestRow {
  id: string;
  subject: string;
  title: string;
  year: string | null;
  description: string | null;
  status: "draft" | "published" | "archived";
  time_limit_minutes: number | null;
  max_attempts: number;
  source_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface PassageRow {
  id: string;
  test_id: string;
  label: string | null;
  body: string;
  image_path: string | null;
  position: number;
}

export interface QuestionRow {
  id: string;
  test_id: string;
  passage_id: string | null;
  position: number;
  number: string;
  answer_type: AnswerType;
  prompt: string;
  options: Choice[];
  match_slots: Choice[];
  image_path: string | null;
  correct: Correct | null;
  points: number;
  scoring: ScoringMode;
  needs_review: boolean;
  review_note: string | null;
}

export interface AttemptRow {
  id: string;
  test_id: string;
  user_id: string;
  status: "in_progress" | "submitted";
  answers: Record<string, unknown>;
  item_results: Record<string, { earned: number; max: number; correct: boolean; answered: boolean }> | null;
  score: number | null;
  max_score: number | null;
  percent: number | null;
  started_at: string;
  submitted_at: string | null;
}

/** Natural sort of question numbers: "2" < "10", "12.2" < "12.10". */
export function compareNumbers(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? -1;
    const y = pb[i] ?? -1;
    if (Number.isNaN(x) || Number.isNaN(y)) return a.localeCompare(b);
    if (x !== y) return x - y;
  }
  return 0;
}

export async function loadTest(testId: string) {
  const admin = createAdminClient();
  const [{ data: test }, { data: passages }, { data: questions }] = await Promise.all([
    admin.from("attestation_tests").select("*").eq("id", testId).maybeSingle(),
    admin.from("attestation_passages").select("*").eq("test_id", testId).order("position"),
    admin.from("attestation_questions").select("*").eq("test_id", testId).order("position"),
  ]);
  if (!test) return null;
  return {
    test: test as TestRow,
    passages: (passages ?? []) as PassageRow[],
    questions: (questions ?? []) as QuestionRow[],
  };
}

/** Short-lived signed URLs for figure paths (the bucket is private). */
export async function signFigures(paths: (string | null | undefined)[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths.filter((p): p is string => !!p)));
  if (unique.length === 0) return {};
  const admin = createAdminClient();
  const { data } = await admin.storage.from(FIGURE_BUCKET).createSignedUrls(unique, 60 * 60 * 4);
  const out: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) out[row.path] = row.signedUrl;
  }
  return out;
}

/** Reasons a test cannot be published, or [] when it can. */
export function publishBlockers(questions: QuestionRow[], validate: (q: QuestionRow) => string[]): string[] {
  const out: string[] = [];
  if (questions.length === 0) out.push("The test has no questions");
  for (const q of questions) {
    if (q.needs_review) out.push(`Q${q.number}: marked "needs review"${q.review_note ? ` — ${q.review_note}` : ""}`);
    for (const e of validate(q)) out.push(`Q${q.number}: ${e}`);
  }
  return out;
}

/** Parse a JSON body, or a 400 response. */
export async function readJson(req: Request): Promise<{ body: unknown } | { error: Response }> {
  try {
    return { body: await req.json() };
  } catch {
    return { error: jsonError("Invalid JSON body", 400) };
  }
}

/** First zod issue as "path: message", for a 400. */
export function zodMessage(err: unknown): string {
  if (err && typeof err === "object" && "issues" in err && Array.isArray((err as { issues: unknown[] }).issues)) {
    const issue = (err as { issues: { path: (string | number)[]; message: string }[] }).issues[0];
    if (issue) return `${issue.path.join(".") || "body"}: ${issue.message}`;
  }
  return err instanceof Error ? err.message : "Invalid input";
}

/** Test id + status of a question's test, for edit guards. */
export async function testOfQuestion(questionId: string): Promise<{ test_id: string; status: TestRow["status"]; question: QuestionRow } | null> {
  const admin = createAdminClient();
  const { data: q } = await admin.from("attestation_questions").select("*").eq("id", questionId).maybeSingle();
  if (!q) return null;
  const { data: t } = await admin.from("attestation_tests").select("status").eq("id", q.test_id).single();
  return { test_id: q.test_id, status: (t?.status ?? "draft") as TestRow["status"], question: q as QuestionRow };
}

export async function testStatus(testId: string): Promise<TestRow["status"] | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("attestation_tests").select("status").eq("id", testId).maybeSingle();
  return (data?.status as TestRow["status"] | undefined) ?? null;
}

/** True when the passage exists and belongs to the given test (null passage is always fine). */
export async function passageInTest(passageId: string | null | undefined, testId: string): Promise<boolean> {
  if (!passageId) return true;
  const admin = createAdminClient();
  const { data } = await admin.from("attestation_passages").select("test_id").eq("id", passageId).maybeSingle();
  return data?.test_id === testId;
}

export const PUBLISHED_LOCKED = "This test is published. Unpublish it first to add, remove or restructure questions.";
