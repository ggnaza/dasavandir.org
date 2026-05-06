import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit-log";
import { z } from "zod";

const updateSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["admin", "course_creator", "course_manager", "learner"]),
});

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

    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) return new Response(JSON.stringify({ error: "Invalid input" }), { status: 400 });

    const { userId, role } = parsed.data;

    const { error } = await admin.from("profiles").update({ role }).eq("id", userId);
    if (error) {
      console.error("[users/update-role]", error);
      return new Response(JSON.stringify({ error: "Failed to update role" }), { status: 500 });
    }

    await logAudit("update_role", user.id, req, { target_user_id: userId, new_role: role });

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err: any) {
    const isAuthError = err.message === "Unauthorized" || err.message === "Forbidden";
    return new Response(JSON.stringify({ error: err.message }), { status: isAuthError ? 403 : 500 });
  }
}

export async function GET() {
  try {
    const { admin } = await checkAdmin();
    const { data: users, error } = await admin
      .from("profiles")
      .select("id, full_name, email, role, status, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[users/list]", error);
      return new Response(JSON.stringify({ error: "Failed to fetch users" }), { status: 500 });
    }
    return new Response(JSON.stringify({ users }), { status: 200 });
  } catch (err: any) {
    const isAuthError = err.message === "Unauthorized" || err.message === "Forbidden";
    return new Response(JSON.stringify({ error: err.message }), { status: isAuthError ? 403 : 500 });
  }
}
