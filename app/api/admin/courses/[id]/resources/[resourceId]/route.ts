import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCourseOwner } from "@/lib/assert-course-owner";

const EDITOR_ROLES = ["admin", "course_creator", "course_manager", "space_manager"];

export async function DELETE(
  req: Request,
  { params }: { params: { id: string; resourceId: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!EDITOR_ROLES.includes(profile?.role ?? "")) return new Response("Forbidden", { status: 403 });

  // Must be an editor of THIS course, not merely hold an editor role — otherwise any
  // editor could delete another course's resources (and their storage files) by id.
  const ownerErr = await assertCourseOwner(params.id, user.id);
  if (ownerErr) return ownerErr;

  const { data: resource } = await admin
    .from("course_resources")
    .select("id, storage_path, course_id")
    .eq("id", params.resourceId)
    .eq("course_id", params.id)
    .single();

  if (!resource) return new Response("Not found", { status: 404 });

  if (resource.storage_path) {
    await admin.storage.from("course-resources").remove([resource.storage_path]);
  }

  await admin.from("course_resources").delete().eq("id", params.resourceId);

  return Response.json({ ok: true });
}
