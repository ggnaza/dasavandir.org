import { getEfficacyUser, requireAuth, requireLdm } from "@/lib/efficacy/auth";
import { efficacyDb } from "@/lib/efficacy/db";
import { COMPETENCY_CATEGORIES } from "@/lib/efficacy/constants";
import { z } from "zod";

export async function GET(req: Request) {
  const user = await getEfficacyUser();
  const denied = requireAuth(user) ?? requireLdm(user!);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const teacherId = searchParams.get("teacherId");
  if (!teacherId) return Response.json({ error: "teacherId required" }, { status: 400 });

  const db = efficacyDb();
  const { data, error } = await db
    .from("manifestations")
    .select("*")
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Group by competency category (same shape the frontend expects)
  const grouped = COMPETENCY_CATEGORIES.map((cat) => ({
    ...cat,
    competencies: cat.competencies.map((name) => ({
      name,
      manifestations: (data ?? []).filter((m: { competency: string }) => m.competency === name),
    })),
  }));

  return Response.json(grouped);
}

const createSchema = z.object({
  teacherId: z.string().uuid(),
  period: z.string().max(200).optional(),
  text: z.string().min(1).max(5000),
  competency: z.string().min(1),
  categoryKey: z.string().optional(),
  categoryName: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  aiNote: z.string().max(3000).optional(),
});

export async function POST(req: Request) {
  const user = await getEfficacyUser();
  const denied = requireAuth(user) ?? requireLdm(user!);
  if (denied) return denied;

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  const db = efficacyDb();
  const { data, error } = await db
    .from("manifestations")
    .insert({
      author_id: user!.id,
      teacher_id: parsed.data.teacherId,
      period: parsed.data.period ?? null,
      text: parsed.data.text,
      competency: parsed.data.competency,
      category_key: parsed.data.categoryKey ?? null,
      category_name: parsed.data.categoryName ?? null,
      confidence: parsed.data.confidence ?? null,
      ai_note: parsed.data.aiNote ?? null,
    })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data, { status: 201 });
}
