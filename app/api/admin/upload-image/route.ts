import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireRole, EDITOR_ROLES } from "@/lib/auth/require-role";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";

// Only real image types are accepted, and the stored content-type is taken from
// this allowlist — never from the client-supplied file.type/filename. This blocks
// uploading HTML/SVG (which can carry script) and getting a hosted URL for it.
const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Lesson-image uploads are an editor action — not open to every logged-in user.
  const admin = createAdminClient();
  const deny = await requireRole(admin, user.id, EDITOR_ROLES);
  if (deny) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Cap upload volume per user so the endpoint can't be used to fill storage.
  const { allowed } = await checkRateLimit(`upload-image:${user.id}`, 60, 60 * 60_000);
  if (!allowed) return rateLimitResponse({ limit: 60, windowSecs: 3600 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Max 10MB" }, { status: 400 });

  const ext = ALLOWED_IMAGE_TYPES[file.type];
  if (!ext) {
    return NextResponse.json({ error: "Unsupported image type (png, jpg, webp, gif only)" }, { status: 400 });
  }

  const path = `images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await admin.storage
    .from("lesson-documents")
    .upload(path, await file.arrayBuffer(), {
      contentType: file.type, // safe: validated against ALLOWED_IMAGE_TYPES above
      upsert: false,
    });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = admin.storage.from("lesson-documents").getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
