import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// POST /api/profile/avatar — upload the logged-in user's avatar to the public `avatars` bucket and
// store its URL on their profile. Mirrors app/api/admin/course-cover.
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return new Response(JSON.stringify({ error: "No file" }), { status: 400 });
  if (!ALLOWED.includes(file.type)) return new Response(JSON.stringify({ error: "Use a JPEG, PNG, WebP, or GIF image" }), { status: 400 });
  if (file.size > MAX_BYTES) return new Response(JSON.stringify({ error: "Image must be under 5 MB" }), { status: 400 });

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "image/gif" ? "gif" : "jpg";
  const path = `${user.id}/avatar.${ext}`;

  const admin = createAdminClient();
  const { error: upErr } = await admin.storage
    .from("avatars")
    .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: true });
  if (upErr) return new Response(JSON.stringify({ error: upErr.message }), { status: 500 });

  // Cache-bust: the path is stable (upsert), so append a version query so the new image shows.
  const { data } = admin.storage.from("avatars").getPublicUrl(path);
  const url = `${data.publicUrl}?v=${Date.now()}`;

  const { error: updErr } = await admin.from("profiles").update({ avatar_url: url }).eq("id", user.id);
  if (updErr) return new Response(JSON.stringify({ error: updErr.message }), { status: 500 });

  return Response.json({ avatar_url: url });
}
