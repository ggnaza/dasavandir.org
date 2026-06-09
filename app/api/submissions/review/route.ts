import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";
import { sendSubmissionVerdictEmail } from "@/lib/email";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { logAudit } from "@/lib/audit-log";
import { z } from "zod";

// Helper: notify a single learner (in-app + email) about a submission verdict
async function notifyLearner(
  admin: any,
  userId: string,
  status: "approved" | "needs_revision" | "not_approved",
  assignmentTitle: string,
  courseTitle: string,
  notifLink: string,
  instructorNote: string | null,
  courseId: string,
  lessonId: string | null,
) {
  const messages = {
    approved:       { title: "Submission approved ✓",    body: `Your submission for "${assignmentTitle}" has been approved.` },
    needs_revision: { title: "Revision needed ↩",        body: `Your submission for "${assignmentTitle}" needs revision. See your facilitator's note.` },
    not_approved:   { title: "Submission not approved",  body: `Your submission for "${assignmentTitle}" was not approved. See feedback for details.` },
  };
  const notif = messages[status];

  await createNotification({ user_id: userId, type: status, title: notif.title, body: notif.body, link: notifLink });

  const { data: learnerProfile } = await admin.from("profiles").select("email, full_name").eq("id", userId).maybeSingle();
  const { data: courseData } = await admin.from("courses").select("title").eq("id", courseId).maybeSingle();

  if (learnerProfile?.email) {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dasavandir.org";
    sendSubmissionVerdictEmail({
      to: learnerProfile.email,
      firstName: learnerProfile.full_name?.split(" ")[0] || "",
      assignmentTitle,
      courseTitle: courseTitle || courseData?.title || "",
      verdict: status,
      instructorNote,
      assignmentUrl: `${baseUrl}${notifLink}`,
    }).catch((err) => console.error("[submission/verdict-email]", err));
  }
}

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
    .select("user_id, assignment_id, group_id, assignments(title)")
    .single();

  if (error) return new Response(error.message, { status: 500 });

  await logAudit("review_submission", user.id, req, { submission_id, action, course_id: courseId });

  if (submission) {
    const assignment = submission.assignments as any;
    const notifLink = lessonId
      ? `/learn/courses/${courseId}/lessons/${lessonId}/assignment`
      : "/learn";

    const { data: courseData } = await admin.from("courses").select("title").eq("id", courseId).maybeSingle();
    const courseTitle = courseData?.title ?? "";
    const assignmentTitle = assignment?.title ?? "Assignment";
    const isFinalVerdict = status === "approved" || status === "not_approved";

    // ── Group submission: fan-out + notify all members ─────────────────────
    if ((submission as any).group_id) {
      const groupId = (submission as any).group_id;

      const { data: members } = await admin
        .from("course_group_members")
        .select("user_id")
        .eq("group_id", groupId);

      const allMemberIds = (members ?? []).map((m: any) => m.user_id);
      const otherMemberIds = allMemberIds.filter((id: string) => id !== submission.user_id);

      // Fan-out: create individual approved/not_approved rows for all other members
      // so their scoresheets and gradebook work without any query changes
      if (isFinalVerdict && otherMemberIds.length > 0) {
        await admin.from("submissions").insert(
          otherMemberIds.map((memberId: string) => ({
            assignment_id: submission.assignment_id,
            user_id: memberId,
            group_id: groupId,
            status,
            final_score: final_score ?? null,
            final_feedback: final_feedback ?? null,
            instructor_note: instructor_note?.trim() ?? null,
            reviewed_at: new Date().toISOString(),
            submitted_at: new Date().toISOString(),
            content: null,
          }))
        );
      }

      // Notify every group member (submitter + others)
      for (const memberId of allMemberIds) {
        await notifyLearner(
          admin, memberId,
          status as "approved" | "needs_revision" | "not_approved",
          assignmentTitle, courseTitle, notifLink,
          instructor_note ?? null, courseId, lessonId,
        );
      }
    } else {
      // ── Individual submission: notify just the submitter ─────────────────
      await notifyLearner(
        admin, submission.user_id,
        status as "approved" | "needs_revision" | "not_approved",
        assignmentTitle, courseTitle, notifLink,
        instructor_note ?? null, courseId, lessonId,
      );
    }
  }

  return new Response("OK");
}
