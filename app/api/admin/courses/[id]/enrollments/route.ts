import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { logAudit } from "@/lib/audit-log";
import { z } from "zod";

const schema = z.object({ userId: z.string().uuid() });

// DELETE /api/admin/courses/[id]/enrollments — unenroll a learner from a course.
// Removes only the enrollment row (revoking course access); the user's account
// and their progress history are preserved so they can be re-enrolled later.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const ownerErr = await assertCourseOwner(params.id, user.id);
  if (ownerErr) return ownerErr;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("enrollments")
    .delete()
    .eq("course_id", params.id)
    .eq("user_id", parsed.data.userId);

  if (error) {
    console.error("[courses/enrollments/delete]", error);
    return new Response(`Failed to unenroll: ${error.message}`, { status: 500 });
  }

  await logAudit("unenroll_learner", user.id, req, {
    course_id: params.id,
    user_id: parsed.data.userId,
  });
  return Response.json({ ok: true });
}
