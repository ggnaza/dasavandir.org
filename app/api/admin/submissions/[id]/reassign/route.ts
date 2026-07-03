import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { getCourseReviewers } from "@/lib/course-reviewers";
import { logAudit } from "@/lib/audit-log";
import { z } from "zod";

const schema = z.object({ reviewerId: z.string().uuid().nullable() });

// POST /api/admin/submissions/[id]/reassign — set the submission's reviewer
// (a moderator or creator of the course). null clears the override (back to the
// learner's group moderator). Admins and course creators only.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "course_creator"].includes(profile?.role ?? "")) {
    return new Response("Only admins and course creators can reassign reviews.", { status: 403 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });
  const { reviewerId } = parsed.data;

  // Resolve the submission's course.
  const { data: sub } = await admin
    .from("submissions")
    .select("id, assignments(lessons(course_id))")
    .eq("id", params.id)
    .single();
  const courseId = ((sub?.assignments as any)?.lessons as any)?.course_id;
  if (!courseId) return new Response("Submission not found", { status: 404 });

  const ownerErr = await assertCourseOwner(courseId, user.id);
  if (ownerErr) return ownerErr;

  // Validate the target is a reviewer of this course.
  if (reviewerId) {
    const reviewers = await getCourseReviewers(admin, courseId);
    if (!reviewers.some((r) => r.id === reviewerId)) {
      return new Response("That person can't review this course.", { status: 400 });
    }
  }

  const { error } = await admin.from("submissions").update({ reviewer_id: reviewerId }).eq("id", params.id);
  if (error) {
    if (error.code === "42703" || /does not exist/i.test(error.message)) {
      return new Response(
        "Reassignment isn't enabled yet — run the add_submission_reviewer_id.sql migration in Supabase.",
        { status: 500 }
      );
    }
    console.error("[submissions/reassign]", error);
    return new Response("Failed to reassign", { status: 500 });
  }

  await logAudit("reassign_review", user.id, req, { course_id: courseId, submission_id: params.id, reviewer_id: reviewerId });
  return Response.json({ ok: true });
}
