import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { logAudit } from "@/lib/audit-log";
import { z } from "zod";

const schema = z.object({ userId: z.string().uuid() });

const patchSchema = z.object({
  userId: z.string().uuid(),
  action: z.enum(["suspend", "reactivate"]),
  reason: z.string().max(500).optional(),
});

// PATCH /api/admin/courses/[id]/enrollments — suspend or reactivate a learner's
// course access without deleting the enrollment. Suspension is reversible and
// preserves enrolled_at, progress, and roster visibility (unlike unenroll/DELETE).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const ownerErr = await assertCourseOwner(params.id, user.id);
  if (ownerErr) return ownerErr;

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const { userId, action, reason } = parsed.data;
  const admin = createAdminClient();

  const patch =
    action === "suspend"
      ? {
          status: "suspended",
          suspended_at: new Date().toISOString(),
          suspended_by: user.id,
          suspend_reason: reason ?? null,
        }
      : { status: "active", suspended_at: null, suspended_by: null, suspend_reason: null };

  const { data: updated, error } = await admin
    .from("enrollments")
    .update(patch)
    .eq("course_id", params.id)
    .eq("user_id", userId)
    .select("user_id")
    .maybeSingle();

  if (error) {
    console.error("[courses/enrollments/patch]", error);
    return new Response(`Failed to ${action}: ${error.message}`, { status: 500 });
  }
  if (!updated) return new Response("Enrollment not found", { status: 404 });

  await logAudit(action === "suspend" ? "suspend_learner" : "reactivate_learner", user.id, req, {
    course_id: params.id,
    user_id: userId,
    ...(action === "suspend" && reason ? { reason } : {}),
  });
  return Response.json({ ok: true });
}

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
