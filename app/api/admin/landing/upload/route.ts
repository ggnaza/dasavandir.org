import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole, ADMIN_ROLES } from "@/lib/auth/require-role";

// POST /api/admin/landing/upload — upload a landing-page image to the public `site`
// bucket and return its URL. Admin-only. Mirrors app/api/profile/avatar.
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const admin = createAdminClient();
  const deny = await requireRole(admin, user.id, ADMIN_ROLES);
  if (deny) return deny;

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return new Response(JSON.stringify({ error: "No file" }), { status: 400 });
  if (!ALLOWED.includes(file.type)) return new Response(JSON.stringify({ error: "Use a JPEG, PNG, WebP, GIF, or SVG image" }), { status: 400 });
  if (file.size > MAX_BYTES) return new Response(JSON.stringify({ error: "Image must be under 8 MB" }), { status: 400 });

  const extMap: Record<string, string> = {
    "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg", "image/jpeg": "jpg",
  };
  const ext = extMap[file.type] ?? "jpg";
  const path = `uploads/${Date.now()}-${Math.round(Math.random() * 1e9).toString(36)}.${ext}`;

  const { error: upErr } = await admin.storage
    .from("site")
    .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
  if (upErr) return new Response(JSON.stringify({ error: upErr.message }), { status: 500 });

  const { data } = admin.storage.from("site").getPublicUrl(path);
  return Response.json({ url: data.publicUrl });
}
