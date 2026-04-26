import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return new Response("Forbidden", { status: 403 });

  const { userId, role } = await req.json();

  if (!["admin", "course_creator", "learner"].includes(role)) {
    return new Response("Invalid role", { status: 400 });
  }

  const { error } = await admin.from("profiles").update({ role }).eq("id", userId);

  if (error) return new Response(error.message, { status: 400 });

  await admin.from("audit_logs").insert({
    user_id: user.id,
    action: "update_role",
    entity_type: "user",
    entity_id: userId,
    details: { new_role: role },
  });

  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
