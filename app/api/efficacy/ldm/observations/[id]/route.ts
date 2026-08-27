import { getEfficacyUser, requireAuth, requireLdm } from "@/lib/efficacy/auth";
import { efficacyDb } from "@/lib/efficacy/db";
import {
  computeTeachingRubric,
  computePlanningRubric,
  computeOverallExpectationsRubric,
  computeGrandAverage,
  normalizeTimeline,
} from "@/lib/efficacy/rubrics";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getEfficacyUser();
  const denied = requireAuth(user) ?? requireLdm(user!);
  if (denied) return denied;

  const db = efficacyDb();
  let query = db
    .from("lesson_observations")
    .select("*, teacher:teacher_id(id, full_name, email), ldm:ldm_id(id, full_name)")
    .eq("id", params.id);

  if (user!.role !== "admin") query = query.eq("ldm_id", user!.id);

  const { data, error } = await query.maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(data);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getEfficacyUser();
  const denied = requireAuth(user) ?? requireLdm(user!);
  if (denied) return denied;

  const db = efficacyDb();

  // Verify ownership
  const { data: existing } = await db
    .from("lesson_observations")
    .select("id, ldm_id, sent")
    .eq("id", params.id)
    .maybeSingle();

  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
  if (user!.role !== "admin" && existing.ldm_id !== user!.id)
    return Response.json({ error: "Forbidden" }, { status: 403 });
  if (existing.sent) return Response.json({ error: "Cannot edit a sent observation" }, { status: 400 });

  const body = await req.json();
  const planning = computePlanningRubric(body.planningRubric);
  const teaching = computeTeachingRubric(body.teachingRubric);
  const overall = computeOverallExpectationsRubric(body.overallExpectations);
  const grandAverage = computeGrandAverage(planning.overallAverage, teaching.overallAverage, overall.overallAverage);

  const { data, error } = await db
    .from("lesson_observations")
    .update({
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
      strengths: body.strengths ?? null,
      areas_for_growth: body.areasForGrowth ?? null,
      recommendations: body.recommendations ?? null,
    })
    .eq("id", params.id)
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}
