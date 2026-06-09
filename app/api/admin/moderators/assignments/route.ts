import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { z } from "zod";

// GET /api/admin/moderators/assignments?course_id=...&moderator_id=...
export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const course_id = searchParams.get("course_id");
  const moderator_id = searchParams.get("moderator_id");
  if (!course_id) return new Response("Missing course_id", { status: 400 });

  const accessErr = await assertCourseOwner(course_id, user.id);
  if (accessErr) return accessErr;

  const admin = createAdminClient();
  let query = admin
    .from("moderator_cohort_assignments")
    .select("id, moderator_id, learner_id, created_at")
    .eq("course_id", course_id);

  if (moderator_id) query = query.eq("moderator_id", moderator_id);

  const { data, error } = await query;
  if (error) return new Response("Failed", { status: 500 });
  return Response.json(data ?? []);
}

const postSchema = z.object({
  course_id: z.string().uuid(),
  moderator_id: z.string().uuid(),
  learner_ids: z.array(z.string().uuid()).min(1).max(200),
});

// POST — assign learners to moderator
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const parsed = postSchema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });
  const { course_id, moderator_id, learner_ids } = parsed.data;

  const accessErr = await assertCourseOwner(course_id, user.id);
  if (accessErr) return accessErr;

  const admin = createAdminClient();
  const rows = learner_ids.map((learner_id) => ({ moderator_id, course_id, learner_id }));
  const { error } = await admin
    .from("moderator_cohort_assignments")
    .upsert(rows, { onConflict: "moderator_id,course_id,learner_id" });

  if (error) return new Response(error.message, { status: 500 });
  return Response.json({ ok: true });
}

const deleteSchema = z.object({
  course_id: z.string().uuid(),
  moderator_id: z.string().uuid(),
  learner_id: z.string().uuid().optional(),
});

// DELETE — unassign learner(s) from moderator
export async function DELETE(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const parsed = deleteSchema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });
  const { course_id, moderator_id, learner_id } = parsed.data;

  const accessErr = await assertCourseOwner(course_id, user.id);
  if (accessErr) return accessErr;

  const admin = createAdminClient();
  let query = admin
    .from("moderator_cohort_assignments")
    .delete()
    .eq("moderator_id", moderator_id)
    .eq("course_id", course_id);

  if (learner_id) query = query.eq("learner_id", learner_id);

  await query;
  return new Response(null, { status: 204 });
}
