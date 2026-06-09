import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { logAudit } from "@/lib/audit-log";
import { z } from "zod";

const schema = z.object({
  submission_id: z.string().uuid(),
  // approve       → Approved (final, released to learner)
  // needs_revision → Needs to be Revised (reopened; note is mandatory)
  // not_approved  → Not Approved (final rejection; no resubmission)
  action: z.enum(["approve", "needs_revision", "not_approved"]),
  final_score: z.number().min(0).max(100).nullable().optional(),
  instructor_note: z.string().max(2000).nullable().optional(),
  final_feedback: z.any().optional(),
});

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!profile) return new Response("Unauthorized", { status: 401 });
  const REVIEWER_ROLES = ["admin", "course_creator", "course_manager"];
  if (!REVIEWER_ROLES.includes(profile.role)) return new Response("Forbidden", { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });
  const { submission_id, action, final_score, instructor_note, final_feedback } = parsed.data;

  // needs_revision requires a note — enforce server-side
  if (action === "needs_revision" && !instructor_note?.trim()) {
    return new Response("A revision note is required when returning for revision.", { status: 400 });
  }

  const { data: subCourse } = await admin
    .from("submissions")
    .select("assignments(lesson_id, lessons(course_id))")
    .eq("id", submission_id)
    .single();

  const courseId = (subCourse?.assignments as any)?.lessons?.course_id;
  const lessonId = (subCourse?.assignments as any)?.lesson_id;
  if (!courseId) return new Response("Course not found", { status: 404 });

  const ownerErr = await assertCourseOwner(courseId, user.id);
  if (ownerErr) return ownerErr;

  const status =
    action === "approve" ? "approved" :
    action === "needs_revision" ? "needs_revision" :
    "not_approved";

  const { data: submission, error } = await admin
    .from("submissions")
    .update({
      status,
      final_score: final_score ?? null,
      instructor_note: instructor_note?.trim() ?? null,
      final_feedback: final_feedback ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", submission_id)
    .select("user_id, assignment_id, assignments(title)")
    .single();

  if (error) return new Response(error.message, { status: 500 });

  await logAudit("review_submission", user.id, req, { submission_id, action, course_id: courseId });

  if (submission) {
    const assignment = submission.assignments as any;
    const notifLink = lessonId
      ? `/learn/courses/${courseId}/lessons/${lessonId}/assignment`
      : "/learn";

    const messages: Record<string, { title: string; body: string }> = {
      approved: {
        title: "Submission approved ✓",
        body: `Your submission for "${assignment?.title}" has been approved.`,
      },
      needs_revision: {
        title: "Revision needed ↩",
        body: `Your submission for "${assignment?.title}" needs revision. See your facilitator's note.`,
      },
      not_approved: {
        title: "Submission not approved",
        body: `Your submission for "${assignment?.title}" was not approved. See feedback for details.`,
      },
    };

    const notif = messages[status];
    if (notif) {
      await createNotification({
        user_id: submission.user_id,
        type: status,
        title: notif.title,
        body: notif.body,
        link: notifLink,
      });
    }
  }

  return new Response("OK");
}
