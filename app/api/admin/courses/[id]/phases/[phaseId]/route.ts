import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { z } from "zod";

async function ownedPhase(admin: any, courseId: string, phaseId: string) {
  const { data } = await admin
    .from("course_phases")
    .select("id")
    .eq("id", phaseId)
    .eq("course_id", courseId)
    .maybeSingle();
  return data;
}

// PATCH /api/admin/courses/[id]/phases/[phaseId] — rename a phase.
export async function PATCH(
  req: Request,
  { params }: { params: { id: string; phaseId: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const ownerErr = await assertCourseOwner(params.id, user.id);
  if (ownerErr) return ownerErr;

  const admin = createAdminClient();
  if (!(await ownedPhase(admin, params.id, params.phaseId))) {
    return new Response("Phase not found", { status: 404 });
  }

  const parsed = z.object({ name: z.string().min(1).max(100) }).safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const { error } = await admin
    .from("course_phases")
    .update({ name: parsed.data.name.trim() })
    .eq("id", params.phaseId);

  if (error) return new Response(error.message, { status: 500 });
  return new Response("OK");
}

// DELETE /api/admin/courses/[id]/phases/[phaseId] — remove a phase. Lessons and
// groups pointing at it revert to phase_id NULL (ON DELETE SET NULL), i.e. untagged.
export async function DELETE(
  req: Request,
  { params }: { params: { id: string; phaseId: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const ownerErr = await assertCourseOwner(params.id, user.id);
  if (ownerErr) return ownerErr;

  const admin = createAdminClient();
  if (!(await ownedPhase(admin, params.id, params.phaseId))) {
    return new Response("Phase not found", { status: 404 });
  }

  const { error } = await admin.from("course_phases").delete().eq("id", params.phaseId);
  if (error) return new Response(error.message, { status: 500 });
  return new Response("OK");
}
