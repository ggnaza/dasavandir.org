import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = createClient();
    const admin = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });

    const { email, password, fullName, role } = await req.json();

    if (!email || !password || !fullName) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      user_metadata: { full_name: fullName },
    });

    if (authError) {
      return new Response(JSON.stringify({ error: authError.message }), { status: 400 });
    }

    const { error: profileError } = await admin.from("profiles").insert({
      id: authData.user.id,
      full_name: fullName,
      role: role || "learner",
    });

    if (profileError) {
      return new Response(JSON.stringify({ error: profileError.message }), { status: 400 });
    }

    await admin.from("audit_logs").insert({
      user_id: user.id,
      action: "create_user",
      entity_type: "user",
      entity_id: authData.user.id,
      details: { email, full_name: fullName, role: role || "learner" },
    });

    return new Response(JSON.stringify({ success: true, userId: authData.user.id }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
