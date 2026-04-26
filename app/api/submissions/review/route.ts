import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { logAudit } from "@/lib/audit-log";
import { z } from "zod";

const schema = z.object({
  submission_id: z.string().uuid(),
  action: z.enum(["approve", "return"]),
  final_score: z.number().min(0).max(100).nullable().optional(),
  instructor_note: z.string().max(2000).nullable().optional(),
  final_feedback: z.string().max(5000).nullable().optional(),
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

  const { data: subCourse } = await admin
    .from("submissions")
    .select("assignments(lessons(course_id))")
    .eq("id", submission_id)
    .single();

  const courseId = (subCourse?.assignments as any)?.lessons?.course_id;
  if (!courseId) return new Response("Course not found", { status: 404 });

  const ownerErr = await assertCourseOwner(courseId, user.id);
  if (ownerErr) return ownerErr;

  const status = action === "approve" ? "approved" : "returned";

  const { data: submission, error } = await admin
    .from("submissions")
    .update({
      status,
      final_score: final_score ?? null,
      instructor_note: instructor_note ?? null,
      final_feedback: final_feedback ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", submission_id)
    .select("user_id, assignment_id, assignments(title, lessons(course_id))")
    .single();

  if (error) return new Response(error.message, { status: 500 });

  await logAudit("review_submission", user.id, req, { submission_id, action, course_id: courseId });

  if (submission) {
    const assignment = submission.assignments as any;
    const submissionCourseId = assignment?.lessons?.course_id;
    await createNotification({
      user_id: submission.user_id,
      type: status,
      title: status === "approved" ? "Submission approved" : "Submission returned",
      body: `Your submission for "${assignment?.title}" has been ${status === "approved" ? "approved" : "returned with feedback"}.`,
      link: submissionCourseId ? `/learn/courses/${submissionCourseId}/lessons/${assignment?.lesson_id}/assignment` : "/learn",
    });
  }

  return new Response("OK");
}
