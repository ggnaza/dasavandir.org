import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { logAudit } from "@/lib/audit-log";
import { z } from "zod";

const schema = z.object({
  submission_id: z.string().uuid(),
  action: z.enum(["approve", "return"]),
  final_score: z.number().min(0).max(100).optional(),
  instructor_note: z.string().max(2000).optional(),
  final_feedback: z.string().max(5000).optional(),
});

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!profile) return new Response("Unauthorized", { status: 401 });
  if (profile.role !== "admin") return new Response("Forbidden", { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });
  const { submission_id, action, final_score, instructor_note, final_feedback } = parsed.data;

  const { data: capstoneCourse } = await admin
    .from("capstone_submissions")
    .select("capstones(course_id)")
    .eq("id", submission_id)
    .single();

  const courseId = (capstoneCourse?.capstones as any)?.course_id;
  if (!courseId) return new Response("Course not found", { status: 404 });

  const ownerErr = await assertCourseOwner(courseId, user.id);
  if (ownerErr) return ownerErr;

  const status = action === "approve" ? "approved" : "returned";

  const { data: submission } = await admin
    .from("capstone_submissions")
    .update({ status, final_score, instructor_note, final_feedback, reviewed_at: new Date().toISOString() })
    .eq("id", submission_id)
    .select("user_id, capstone_id, capstones(title, course_id)")
    .single();

  await logAudit("review_capstone", user.id, req, { submission_id, action, course_id: courseId });

  if (submission) {
    const capstone = submission.capstones as any;
    await createNotification({
      user_id: submission.user_id,
      type: status,
      title: status === "approved" ? "Capstone approved" : "Capstone returned",
      body: `Your capstone "${capstone?.title}" has been ${status === "approved" ? "approved" : "returned with feedback"}.`,
      link: capstone?.course_id ? `/learn/courses/${capstone.course_id}/capstone` : "/learn",
    });
  }

  return Response.json({ ok: true });
}
