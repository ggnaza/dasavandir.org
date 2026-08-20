import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole, ADMIN_ROLES } from "@/lib/auth/require-role";
import { listMenu } from "@/lib/landing/store";
import { replaceMenu, LandingError, type MenuItemInput } from "@/lib/landing/mutations";

async function guard() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { deny: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) };
  const admin = createAdminClient();
  const deny = await requireRole(admin, user.id, ADMIN_ROLES);
  return { deny: deny ?? undefined };
}

export async function GET() {
  const { deny } = await guard();
  if (deny) return deny;
  const items = await listMenu();
  return Response.json({ items });
}

export async function PUT(req: Request) {
  const { deny } = await guard();
  if (deny) return deny;
  try {
    const body = (await req.json()) as { items: MenuItemInput[] };
    await replaceMenu(Array.isArray(body.items) ? body.items : []);
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof LandingError) return new Response(JSON.stringify({ error: e.message }), { status: e.status });
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Server error" }), { status: 500 });
  }
}
