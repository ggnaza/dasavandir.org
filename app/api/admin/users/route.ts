import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function checkAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("Forbidden");

  return { user, admin };
}

export async function POST(req: Request) {
  try {
    const { user, admin } = await checkAdmin();
    const { userId, role } = await req.json();

    if (!["admin", "course_creator", "learner"].includes(role)) {
      return new Response(JSON.stringify({ error: "Invalid role" }), { status: 400 });
    }

    const { error } = await admin.from("profiles").update({ role }).eq("id", userId);
    if (error) {
      console.error("[users/update-role]", error);
      return new Response(JSON.stringify({ error: "Failed to update role" }), { status: 500 });
    }

    await admin.from("audit_logs").insert({
      user_id: user.id,
      action: "update_role",
      entity_type: "user",
      entity_id: userId,
      details: { new_role: role },
    });

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 401 });
  }
}

export async function GET() {
  try {
    const { admin } = await checkAdmin();
    const { data: users, error } = await admin
      .from("profiles")
      .select("id, full_name, role, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[users/list]", error);
      return new Response(JSON.stringify({ error: "Failed to fetch users" }), { status: 500 });
    }
    return new Response(JSON.stringify({ users }), { status: 200 });
  } catch (err: any) {
    const isAuthError = err.message === "Unauthorized" || err.message === "Forbidden";
    return new Response(JSON.stringify({ error: err.message }), { status: isAuthError ? 401 : 500 });
  }
}
