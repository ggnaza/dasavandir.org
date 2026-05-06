import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const EDITOR_ROLES = ["admin", "course_creator", "course_manager"];

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
