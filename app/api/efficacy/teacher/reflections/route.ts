import { getEfficacyUser, requireAuth } from "@/lib/efficacy/auth";
import { efficacyDb } from "@/lib/efficacy/db";
import { computeTeachingRubric, normalizeGoals } from "@/lib/efficacy/rubrics";
import { z } from "zod";

const createSchema = z.object({
  lessonNumber: z.number().int().min(1).optional(),
  academicYear: z.string().max(50).optional(),
  subject: z.string().max(200).optional(),
  topic: z.string().max(500).optional(),
  grade: z.string().max(50).optional(),
  studentsCount: z.number().int().min(0).optional(),
  lessonPlanLink: z.string().url(),
  recordingLink: z.string().url(),
  successfulDirections: z.string().max(5000).optional(),
  previousGoalsProgress: z.string().max(5000).optional(),
  selfRubric: z.any().optional(),
  goals: z.any().optional(),
  content: z.string().max(20000).optional(),
  inputMethod: z.string().max(50).optional(),
});

export async function GET() {
  const user = await getEfficacyUser();
  const denied = requireAuth(user);
  if (denied) return denied;

  const db = efficacyDb();
  const { data, error } = await db
    .from("teacher_reflections")
    .select("*")
    .eq("teacher_id", user!.id)
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

export async function POST(req: Request) {
  const user = await getEfficacyUser();
  const denied = requireAuth(user);
  if (denied) return denied;

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: "Invalid input", details: parsed.error.format() }, { status: 400 });

  const body = parsed.data;
  const selfRubric = computeTeachingRubric(body.selfRubric);

  const db = efficacyDb();
  const { data, error } = await db
    .from("teacher_reflections")
    .insert({
      teacher_id: user!.id,
      lesson_number: body.lessonNumber ?? null,
      academic_year: body.academicYear ?? null,
      subject: body.subject ?? null,
      topic: body.topic ?? null,
      grade: body.grade ?? null,
      students_count: body.studentsCount ?? null,
      lesson_plan_link: body.lessonPlanLink,
      recording_link: body.recordingLink,
      successful_directions: body.successfulDirections ?? null,
      previous_goals_progress: body.previousGoalsProgress ?? null,
      self_rubric: selfRubric,
      goals: normalizeGoals(body.goals),
      content: body.content ?? null,
      input_method: body.inputMethod ?? null,
    })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data, { status: 201 });
}
