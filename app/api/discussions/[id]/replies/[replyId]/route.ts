import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; replyId: string } }
) {
  if (!UUID_RE.test(params.id) || !UUID_RE.test(params.replyId))
    return new Response("Not found", { status: 404 });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: reply } = await admin
    .from("discussion_replies")
    .select("user_id")
    .eq("id", params.replyId)
    .single();

  if (!reply) return new Response("Not found", { status: 404 });

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (reply.user_id !== user.id && profile?.role !== "admin")
    return new Response("Forbidden", { status: 403 });

  await admin.from("discussion_replies").delete().eq("id", params.replyId);
  return Response.json({ deleted: true });
}
