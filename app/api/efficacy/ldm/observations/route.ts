import { getEfficacyUser, requireAuth, requireLdm } from "@/lib/efficacy/auth";
import { efficacyDb } from "@/lib/efficacy/db";
import {
  computeTeachingRubric,
  computePlanningRubric,
  computeOverallExpectationsRubric,
  computeGrandAverage,
  normalizeTimeline,
  normalizeGoals,
} from "@/lib/efficacy/rubrics";
import { z } from "zod";

const createSchema = z.object({
  teacherId: z.string().uuid(),
  date: z.string().optional(),
  lessonNumber: z.number().int().min(1).optional(),
  subject: z.string().max(200).optional(),
  grade: z.string().max(50).optional(),
  lessonPlanLink: z.string().url().optional(),
  recordingLink: z.string().url().optional(),
  planningRubric: z.any().optional(),
  timeline: z.any().optional(),
  teachingRubric: z.any().optional(),
  coaching: z.any().optional(),
  overallExpectations: z.any().optional(),
});

export async function GET(req: Request) {
  const user = await getEfficacyUser();
  const denied = requireAuth(user) ?? requireLdm(user!);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const teacherId = searchParams.get("teacherId");

  const db = efficacyDb();
  let query = db
    .from("lesson_observations")
    .select("*, teacher:teacher_id(id, full_name, email), ldm:ldm_id(id, full_name)")
    .order("created_at", { ascending: false });

  if (user!.role !== "admin") {
    query = query.eq("ldm_id", user!.id);
  }
  if (teacherId) {
    query = query.eq("teacher_id", teacherId);
  }

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

export async function POST(req: Request) {
  const user = await getEfficacyUser();
  const denied = requireAuth(user) ?? requireLdm(user!);
  if (denied) return denied;

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: "Invalid input", details: parsed.error.format() }, { status: 400 });

  const body = parsed.data;

  // Verify this LDM is assigned to the teacher (unless admin)
  if (user!.role !== "admin") {
    const db = efficacyDb();
    const { data: assignment } = await db
      .from("ldm_teacher_assignments")
      .select("id")
      .eq("ldm_id", user!.id)
      .eq("teacher_id", body.teacherId)
      .maybeSingle();
    if (!assignment) return Response.json({ error: "Not assigned to this teacher" }, { status: 403 });
  }

  const planning = computePlanningRubric(body.planningRubric);
  const teaching = computeTeachingRubric(body.teachingRubric);
  const overall = computeOverallExpectationsRubric(body.overallExpectations);
  const grandAverage = computeGrandAverage(planning.overallAverage, teaching.overallAverage, overall.overallAverage);

  const db = efficacyDb();
  const { data, error } = await db
    .from("lesson_observations")
    .insert({
      ldm_id: user!.id,
      teacher_id: body.teacherId,
      date: body.date ?? null,
      lesson_number: body.lessonNumber ?? null,
      subject: body.subject ?? null,
      grade: body.grade ?? null,
      lesson_plan_link: body.lessonPlanLink ?? null,
      recording_link: body.recordingLink ?? null,
      planning_rubric: planning,
      timeline: normalizeTimeline(body.timeline),
      teaching_rubric: teaching,
      coaching: body.coaching ?? {},
      overall_expectations: overall,
      grand_average: grandAverage,
    })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data, { status: 201 });
}
