import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole, ADMIN_ROLES } from "@/lib/auth/require-role";
import { listPages } from "@/lib/landing/store";
import { upsertPage, createPage, deletePage, LandingError, type UpsertPageInput } from "@/lib/landing/mutations";

async function guard() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { deny: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) };
  const admin = createAdminClient();
  const deny = await requireRole(admin, user.id, ADMIN_ROLES);
  return { deny: deny ?? undefined };
}

function fail(e: unknown) {
  if (e instanceof LandingError) return new Response(JSON.stringify({ error: e.message }), { status: e.status });
  const msg = e instanceof Error ? e.message : "Server error";
  return new Response(JSON.stringify({ error: msg }), { status: 500 });
}

export async function GET() {
  const { deny } = await guard();
  if (deny) return deny;
  const pages = await listPages();
  return Response.json({ pages });
}

// Save (create-or-update) a page by slug.
export async function PUT(req: Request) {
  const { deny } = await guard();
  if (deny) return deny;
  try {
    const body = (await req.json()) as UpsertPageInput;
    const saved = await upsertPage(body);
    return Response.json({ ok: true, page: saved });
  } catch (e) {
    return fail(e);
  }
}

// Create a new empty page.
export async function POST(req: Request) {
  const { deny } = await guard();
  if (deny) return deny;
  try {
    const body = (await req.json()) as { slug: string; title: { en: string; hy: string } };
    const page = await createPage(body.slug, body.title);
    return Response.json({ ok: true, page });
  } catch (e) {
    return fail(e);
  }
}

// Delete a page: /api/admin/pages?slug=xyz
export async function DELETE(req: Request) {
  const { deny } = await guard();
  if (deny) return deny;
  try {
    const slug = new URL(req.url).searchParams.get("slug");
    if (!slug) return new Response(JSON.stringify({ error: "Missing slug" }), { status: 400 });
    await deletePage(slug);
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
