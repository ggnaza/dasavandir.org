import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit-log";
import { z } from "zod";

const schema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  fullName: z.string().min(1).max(200),
  role: z.enum(["admin", "course_creator", "course_manager", "learner"]).optional().default("learner"),
});

export async function POST(req: Request) {
  try {
    const supabase = createClient();
    const admin = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return new Response(JSON.stringify({ error: "Invalid input" }), { status: 400 });

    const { email, password, fullName, role } = parsed.data;

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      user_metadata: { full_name: fullName },
    });

    if (authError) {
      console.error("[users/create auth]", authError);
      return new Response(JSON.stringify({ error: authError.message }), { status: 400 });
    }

    const { error: profileError } = await admin.from("profiles").insert({
      id: authData.user.id,
      full_name: fullName,
      role,
    });

    if (profileError) {
      console.error("[users/create profile]", profileError);
      return new Response(JSON.stringify({ error: "Failed to create user profile" }), { status: 500 });
    }

    await logAudit("create_user", user.id, req, {
      email,
      full_name: fullName,
      role,
      new_user_id: authData.user.id,
    });

    return new Response(JSON.stringify({ success: true, userId: authData.user.id }), { status: 200 });
  } catch (err: any) {
    console.error("[users/create]", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}
