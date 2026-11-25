import { createAdminClient } from "@/lib/supabase/admin";
import { denyUnlessManager, getAttestationUser, jsonError, readJson, zodMessage } from "@/lib/attestation/server";
import { testInputSchema } from "@/lib/attestation/schemas";

export const dynamic = "force-dynamic";

/** All tests with question / review / attempt counts (managers only). */
export async function GET() {
  const user = await getAttestationUser();
  const denied = denyUnlessManager(user);
  if (denied) return denied;

  const admin = createAdminClient();
  const [{ data: tests, error }, { data: questions }, { data: attempts }] = await Promise.all([
    admin.from("attestation_tests").select("*").order("subject"),
    admin.from("attestation_questions").select("test_id, needs_review"),
    admin.from("attestation_attempts").select("test_id, status"),
  ]);
  if (error) return jsonError(error.message, 500);

  const count = <T extends { test_id: string }>(rows: T[] | null, id: string, pred: (r: T) => boolean = () => true) =>
    (rows ?? []).filter((r) => r.test_id === id && pred(r)).length;

  return Response.json({
    tests: (tests ?? []).map((t) => ({
      ...t,
      question_count: count(questions, t.id),
      review_count: count(questions, t.id, (q) => q.needs_review),
      submitted_count: count(attempts, t.id, (a) => a.status === "submitted"),
    })),
  });
}

/** Create an empty draft test. */
export async function POST(req: Request) {
  const user = await getAttestationUser();
  const denied = denyUnlessManager(user);
  if (denied) return denied;

  const parsed = await readJson(req);
  if ("error" in parsed) return parsed.error;
  const input = testInputSchema.safeParse(parsed.body);
  if (!input.success) return jsonError(zodMessage(input.error), 400);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("attestation_tests")
    .insert({ ...input.data, status: "draft", created_by: user!.id })
    .select("id")
    .single();
  if (error) return jsonError(error.message, 500);
  return Response.json({ id: data.id });
}
