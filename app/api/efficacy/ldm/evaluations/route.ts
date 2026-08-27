import { getEfficacyUser, requireAuth, requireLdm } from "@/lib/efficacy/auth";
import { efficacyDb } from "@/lib/efficacy/db";
import { COMPETENCY_CATEGORIES, ALL_COMPETENCIES } from "@/lib/efficacy/constants";
import { computeAverage } from "@/lib/efficacy/math";
import { z } from "zod";

const competencySchema = z.object({
  name: z.string(),
  score: z.number().min(0).max(5),
  notes: z.string().max(3000).optional(),
});

const createSchema = z.object({
  teacherId: z.string().uuid(),
  period: z.string().max(200).optional(),
  competencies: z.array(competencySchema).min(1),
  source: z.enum(["manual", "ai-chat"]).optional(),
});

export async function GET(req: Request) {
  const user = await getEfficacyUser();
  const denied = requireAuth(user) ?? requireLdm(user!);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const teacherId = searchParams.get("teacherId");

  const db = efficacyDb();
  let query = db
    .from("competency_evaluations")
    .select("*, teacher:teacher_id(id, full_name, email), evaluator:evaluator_id(id, full_name)")
    .order("created_at", { ascending: false });

  if (user!.role !== "admin") query = query.eq("evaluator_id", user!.id);
  if (teacherId) query = query.eq("teacher_id", teacherId);

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

export async function POST(req: Request) {
  const user = await getEfficacyUser();
  const denied = requireAuth(user) ?? requireLdm(user!);
  if (denied) return denied;

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  const { teacherId, period, competencies, source } = parsed.data;

  // Validate competency names
  const invalid = competencies.filter((c) => !ALL_COMPETENCIES.includes(c.name));
  if (invalid.length > 0)
    return Response.json({ error: `Unknown competencies: ${invalid.map((c) => c.name).join(", ")}` }, { status: 400 });

  // Compute category averages
  const byName: Record<string, number> = {};
  competencies.forEach((c) => { byName[c.name] = c.score; });

  const categoryAverages = COMPETENCY_CATEGORIES.map((cat) => {
    const scores = cat.competencies.map((name) => byName[name]).filter((s): s is number => s !== undefined);
    return { key: cat.key, name: cat.name, average: computeAverage(scores) };
  });

  const averageScore = computeAverage(competencies.map((c) => c.score));

  const db = efficacyDb();
  const { data, error } = await db
    .from("competency_evaluations")
    .insert({
      evaluator_id: user!.id,
      teacher_id: teacherId,
      period: period ?? null,
      competencies,
      category_averages: categoryAverages,
      average_score: averageScore,
      source: source ?? "manual",
    })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data, { status: 201 });
}
