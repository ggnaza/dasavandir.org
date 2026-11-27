import { denyUnlessUser, getAttestationUser, jsonError, loadTest, signFigures } from "@/lib/attestation/server";
import { startOrResume, toPublicQuestion } from "@/lib/attestation/attempts";

export const dynamic = "force-dynamic";

/** Open (or resume) the caller's attempt at a published test. Never returns answers or scores. */
export async function POST(_req: Request, { params }: { params: { testId: string } }) {
  const user = await getAttestationUser();
  const denied = denyUnlessUser(user);
  if (denied) return denied;

  const data = await loadTest(params.testId);
  if (!data || data.test.status !== "published") return jsonError("Test not found", 404);

  const state = await startOrResume(user!.id, data.test, data.questions);
  if (state.state === "done") return Response.json({ state: "done" });

  const figures = await signFigures([
    ...data.questions.map((q) => q.image_path),
    ...data.passages.map((p) => p.image_path),
  ]);
  return Response.json({
    ...state,
    test: {
      id: data.test.id,
      subject: data.test.subject,
      title: data.test.title,
      description: data.test.description,
      time_limit_minutes: data.test.time_limit_minutes,
    },
    passages: data.passages,
    questions: data.questions.map(toPublicQuestion),
    figures,
  });
}
