import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const VALID_MODULES = ["courses", "ararka", "efficacy"];

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (data?.role !== "admin") return null;
  return user;
}

export async function GET(req: Request) {
  const user = await requireAdmin();
  if (!user) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("user_id");
  if (!userId) return Response.json({ error: "user_id is required" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("modules")
    .eq("id", userId)
    .single();

  if (error || !data) return Response.json({ error: "User not found" }, { status: 404 });

  return Response.json({ modules: data.modules ?? ["courses"] });
}

export async function PUT(req: Request) {
  const user = await requireAdmin();
  if (!user) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { user_id, modules } = (await req.json()) as { user_id: string; modules: string[] };
  if (!user_id || !Array.isArray(modules)) {
    return Response.json({ error: "user_id and modules array required" }, { status: 400 });
  }

  const filtered = modules.filter((m) => VALID_MODULES.includes(m));
  if (filtered.length === 0) filtered.push("courses");

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ modules: filtered })
    .eq("id", user_id);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ modules: filtered });
}
