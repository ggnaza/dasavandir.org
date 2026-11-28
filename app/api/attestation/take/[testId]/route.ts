import { denyUnlessUser, getAttestationUser, jsonError, loadTest, mayTakeTest, signFigures } from "@/lib/attestation/server";
import { attemptStanding, startOrResume, toPublicQuestion } from "@/lib/attestation/attempts";

export const dynamic = "force-dynamic";

/**
 * The start screen: title, duration and where the caller stands. Opens nothing,
 * so the clock does not start until the teacher presses Start (POST).
 */
export async function GET(_req: Request, { params }: { params: { testId: string } }) {
  const user = await getAttestationUser();
  const denied = denyUnlessUser(user);
  if (denied) return denied;

  const data = await loadTest(params.testId);
  // Uninvited teachers get the same 404 as a missing test: no hint the test exists.
  if (!data || data.test.status !== "published" || !(await mayTakeTest(user!, data.test.id))) {
    return jsonError("Test not found", 404);
  }
  return Response.json({
    state: await attemptStanding(user!.id, data.test),
    test: {
      id: data.test.id,
      subject: data.test.subject,
      title: data.test.title,
      description: data.test.description,
      time_limit_minutes: data.test.time_limit_minutes,
    },
    question_count: data.questions.length,
  });
}

/** Open (or resume) the caller's attempt at a published test. Never returns answers or scores. */
export async function POST(req: Request, { params }: { params: { testId: string } }) {
  const user = await getAttestationUser();
  const denied = denyUnlessUser(user);
  if (denied) return denied;

  const data = await loadTest(params.testId);
  if (!data || data.test.status !== "published" || !(await mayTakeTest(user!, data.test.id))) {
    return jsonError("Test not found", 404);
  }

  // `?resume=1`: the runner skipped the start screen to resume; never open a new attempt then.
  const resumeOnly = new URL(req.url).searchParams.get("resume") === "1";
  const state = await startOrResume(user!.id, data.test, data.questions, { resumeOnly });
  if (state.state === "done" || state.state === "new") return Response.json({ state: state.state });

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
