import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit-log";
import { z } from "zod";

const schema = z.object({ userId: z.string().uuid() });

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return new Response(JSON.stringify({ error: "Invalid input" }), { status: 400 });

  const { userId } = parsed.data;

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    console.error("[users/delete]", deleteError);
    return new Response(JSON.stringify({ error: "Failed to delete user" }), { status: 400 });
  }

  await logAudit("delete_user", user.id, req, { deleted_user_id: userId });

  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
