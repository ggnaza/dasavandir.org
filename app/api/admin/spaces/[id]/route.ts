import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireRole, ADMIN_ROLES } from "@/lib/auth/require-role";
import { getCurrentOrgId } from "@/lib/org";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  ord: z.number().int().min(0).optional(),
});

// PATCH /api/admin/spaces/[id] — rename or reorder a space (scoped to the current org).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const admin = createAdminClient();
  const deny = await requireRole(admin, user.id, ADMIN_ROLES);
  if (deny) return deny;

  const orgId = await getCurrentOrgId(admin);
  if (!orgId) return new Response(JSON.stringify({ error: "Organization not found" }), { status: 500 });

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return new Response(JSON.stringify({ error: "Invalid input" }), { status: 400 });
  }

  // .eq("org_id", orgId) ensures a space from another org can never be touched.
  const { data, error } = await admin
    .from("spaces")
    .update(parsed.data)
    .eq("id", params.id)
    .eq("org_id", orgId)
    .select("id, name, ord")
    .maybeSingle();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  if (!data) return new Response(JSON.stringify({ error: "Space not found" }), { status: 404 });
  return Response.json({ space: data });
}

// DELETE /api/admin/spaces/[id] — remove a space, but only once no courses reference it.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const admin = createAdminClient();
  const deny = await requireRole(admin, user.id, ADMIN_ROLES);
  if (deny) return deny;

  const orgId = await getCurrentOrgId(admin);
  if (!orgId) return new Response(JSON.stringify({ error: "Organization not found" }), { status: 500 });

  // Block deletion while courses are still in the space (the FK would reject it anyway).
  const { count } = await admin
    .from("courses")
    .select("id", { count: "exact", head: true })
    .eq("space_id", params.id);
  if ((count ?? 0) > 0) {
    return new Response(
      JSON.stringify({ error: `Cannot delete: ${count} course(s) are still in this space. Move them first.` }),
      { status: 409 },
    );
  }

  const { error } = await admin.from("spaces").delete().eq("id", params.id).eq("org_id", orgId);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return Response.json({ ok: true });
}
