import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireRole, ADMIN_ROLES } from "@/lib/auth/require-role";
import { logAudit } from "@/lib/audit-log";
import { z } from "zod";

const updateSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["admin", "course_creator", "course_manager", "learner"]),
});

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const admin = createAdminClient();
  const deny = await requireRole(admin, user.id, ADMIN_ROLES);
  if (deny) return deny;

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
}

export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const admin = createAdminClient();
  const deny = await requireRole(admin, user.id, ADMIN_ROLES);
  if (deny) return deny;

  const url = new URL(req.url);
  const PAGE_SIZE = 50;
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const search = (url.searchParams.get("search") ?? "").trim();

  let query = admin
    .from("profiles")
    .select("id, full_name, email, role, status, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { data: users, error, count } = await query;

  if (error) {
    console.error("[users/list]", error);
    return new Response(JSON.stringify({ error: "Failed to fetch users" }), { status: 500 });
  }
  return new Response(JSON.stringify({ users, total: count ?? 0, page, pageSize: PAGE_SIZE }), { status: 200 });
}
