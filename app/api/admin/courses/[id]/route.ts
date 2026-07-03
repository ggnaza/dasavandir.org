import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { logAudit } from "@/lib/audit-log";

// DELETE /api/admin/courses/[id] — delete a course and all of its dependent data.
//
// Why this runs server-side with the service-role client instead of a direct
// browser Supabase delete: several core child tables (lessons, enrollments,
// capstones, discussions, …) were created manually and do not all have
// ON DELETE CASCADE, so a plain `courses` delete fails with a foreign-key
// violation. The browser client swallowed that error, leaving the UI stuck on
// "Deleting…". We explicitly clear children (deepest first) so deletion works
// regardless of the live cascade configuration.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const ownerErr = await assertCourseOwner(params.id, user.id);
  if (ownerErr) return ownerErr;

  const admin = createAdminClient();
  const courseId = params.id;

  // Collect ids of children that themselves have children (so we can clear
  // grandchildren whose FK may not cascade).
  const [{ data: capstones }, { data: discussions }] = await Promise.all([
    admin.from("capstones").select("id").eq("course_id", courseId),
    admin.from("discussions").select("id").eq("course_id", courseId),
  ]);
  const capstoneIds = (capstones ?? []).map((c) => c.id);
  const discussionIds = (discussions ?? []).map((d) => d.id);

  // Grandchildren first.
  if (capstoneIds.length > 0) {
    await admin.from("capstone_submissions").delete().in("capstone_id", capstoneIds);
  }
  if (discussionIds.length > 0) {
    await admin.from("discussion_replies").delete().in("discussion_id", discussionIds);
  }

  // Direct course children. Deleting `lessons` cascades its own children
  // (progress, quizzes, quiz_responses, assignments, submissions, lesson_files,
  // lesson_sessions, …) — the individual lesson-delete endpoint relies on the
  // same cascade. The rest are cleared explicitly in case their FK does not.
  const childTables = [
    "capstones",
    "discussions",
    "enrollments",
    "progress",
    "question_bank",
    "announcements",
    "certificates",
    "invitations",
    "ai_coach_messages",
    "ai_coach_sessions",
    "ai_coach_memory",
    "course_creator_access",
    "course_manager_access",
    "lessons",
  ] as const;

  for (const table of childTables) {
    const { error } = await admin.from(table).delete().eq("course_id", courseId);
    if (error) {
      console.error(`[courses/delete] failed clearing ${table}`, error);
      return new Response(`Failed to delete course (${table}): ${error.message}`, { status: 500 });
    }
  }

  const { error } = await admin.from("courses").delete().eq("id", courseId);
  if (error) {
    console.error("[courses/delete] failed deleting course", error);
    return new Response(`Failed to delete course: ${error.message}`, { status: 500 });
  }

  await logAudit("delete_course", user.id, _req, { course_id: courseId });
  return Response.json({ ok: true });
}
