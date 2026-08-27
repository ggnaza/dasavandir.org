import { getEfficacyUser, requireAuth, requireLdm } from "@/lib/efficacy/auth";
import { efficacyDb } from "@/lib/efficacy/db";
import { computeAverage, computeTrend } from "@/lib/efficacy/math";

export async function GET(req: Request) {
  const user = await getEfficacyUser();
  const denied = requireAuth(user) ?? requireLdm(user!);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const teacherId = searchParams.get("teacherId");
  if (!teacherId) return Response.json({ error: "teacherId required" }, { status: 400 });

  const db = efficacyDb();
  const { data: evals, error } = await db
    .from("competency_evaluations")
    .select("competencies, created_at")
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: true });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Build the cross-evaluation competency matrix
  const byCompetency: Record<string, number[]> = {};
  (evals ?? []).forEach((ev: { competencies: { name: string; score: number }[] }) => {
    (ev.competencies ?? []).forEach(({ name, score }: { name: string; score: number }) => {
      if (!byCompetency[name]) byCompetency[name] = [];
      byCompetency[name].push(score);
    });
  });

  const matrix = Object.entries(byCompetency).map(([name, scores]) => ({
    name,
    average: computeAverage(scores),
    trend: computeTrend(scores),
    samples: scores.length,
  }));

  return Response.json({ matrix, evaluationCount: evals?.length ?? 0 });
}
