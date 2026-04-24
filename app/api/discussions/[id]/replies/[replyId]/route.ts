import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; replyId: string } }
) {
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
