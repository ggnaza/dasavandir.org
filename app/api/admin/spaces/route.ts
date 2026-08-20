import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireRole, ADMIN_ROLES } from "@/lib/auth/require-role";
import { getCurrentOrgId } from "@/lib/org";
import { z } from "zod";

// GET /api/admin/spaces — list the current org's spaces.
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const admin = createAdminClient();
  const deny = await requireRole(admin, user.id, ADMIN_ROLES);
  if (deny) return deny;

  const orgId = await getCurrentOrgId(admin);
  if (!orgId) return new Response(JSON.stringify({ error: "Organization not found" }), { status: 500 });

  const { data, error } = await admin
    .from("spaces")
    .select("id, name, ord")
    .eq("org_id", orgId)
    .order("ord");
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return Response.json({ spaces: data ?? [] });
}

const createSchema = z.object({ name: z.string().trim().min(1).max(100) });

// POST /api/admin/spaces — create a space in the current org (appended at the end).
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const admin = createAdminClient();
  const deny = await requireRole(admin, user.id, ADMIN_ROLES);
  if (deny) return deny;

  const orgId = await getCurrentOrgId(admin);
  if (!orgId) return new Response(JSON.stringify({ error: "Organization not found" }), { status: 500 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return new Response(JSON.stringify({ error: "Invalid input" }), { status: 400 });

  const { data: maxRow } = await admin
    .from("spaces")
    .select("ord")
    .eq("org_id", orgId)
    .order("ord", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrd = (maxRow?.ord ?? 0) + 1;

  const { data, error } = await admin
    .from("spaces")
    .insert({ org_id: orgId, name: parsed.data.name, ord: nextOrd })
    .select("id, name, ord")
    .single();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return Response.json({ space: data });
}
