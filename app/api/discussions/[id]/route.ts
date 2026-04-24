import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: discussion } = await admin
    .from("discussions")
    .select("user_id")
    .eq("id", params.id)
    .single();

  if (!discussion) return new Response("Not found", { status: 404 });

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (discussion.user_id !== user.id && profile?.role !== "admin")
    return new Response("Forbidden", { status: 403 });

  await admin.from("discussions").delete().eq("id", params.id);
  return Response.json({ deleted: true });
}
