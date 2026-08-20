import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireRole, ADMIN_ROLES } from "@/lib/auth/require-role";
import { getCurrentOrgId } from "@/lib/org";
import { z } from "zod";

// GET /api/admin/space-manager-access?userId=… — the space ids a user MANAGES. Shape matches
// /api/admin/space-members ({ spaceIds }) so the same modal can drive both.
export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const admin = createAdminClient();
  const deny = await requireRole(admin, user.id, ADMIN_ROLES);
  if (deny) return deny;

  const userId = new URL(req.url).searchParams.get("userId");
  if (!userId) return new Response(JSON.stringify({ error: "Missing userId" }), { status: 400 });

  const { data, error } = await admin.from("space_manager_access").select("space_id").eq("manager_id", userId);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return Response.json({ spaceIds: (data ?? []).map((r) => r.space_id) });
}

const bodySchema = z.object({ userId: z.string().uuid(), spaceId: z.string().uuid() });

// POST — make a user a manager of a space (in the current org).
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const admin = createAdminClient();
  const deny = await requireRole(admin, user.id, ADMIN_ROLES);
  if (deny) return deny;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return new Response(JSON.stringify({ error: "Invalid input" }), { status: 400 });
  const { userId, spaceId } = parsed.data;

  const orgId = await getCurrentOrgId(admin);
  const { data: space } = await admin.from("spaces").select("id").eq("id", spaceId).eq("org_id", orgId ?? "").maybeSingle();
  if (!space) return new Response(JSON.stringify({ error: "Space not found" }), { status: 404 });

  const { error } = await admin
    .from("space_manager_access")
    .upsert({ manager_id: userId, space_id: spaceId, granted_by: user.id }, { onConflict: "manager_id,space_id", ignoreDuplicates: true });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return Response.json({ ok: true });
}

// DELETE ?userId=…&spaceId=… — remove a manager from a space.
export async function DELETE(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const admin = createAdminClient();
  const deny = await requireRole(admin, user.id, ADMIN_ROLES);
  if (deny) return deny;

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  const spaceId = url.searchParams.get("spaceId");
  if (!userId || !spaceId) return new Response(JSON.stringify({ error: "Missing userId or spaceId" }), { status: 400 });

  const { error } = await admin.from("space_manager_access").delete().eq("manager_id", userId).eq("space_id", spaceId);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return Response.json({ ok: true });
}
