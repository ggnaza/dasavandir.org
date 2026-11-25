import { createAdminClient } from "@/lib/supabase/admin";
import { denyUnlessManager, FIGURE_BUCKET, getAttestationUser, jsonError } from "@/lib/attestation/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Content type comes from this allowlist, never from the client (no HTML/SVG uploads).
const ALLOWED: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Upload a question/passage figure to the private bucket. Returns its storage path and a preview URL. */
export async function POST(req: Request) {
  const user = await getAttestationUser();
  const denied = denyUnlessManager(user);
  if (denied) return denied;

  const { allowed } = await checkRateLimit(`attestation-figure:${user!.id}`, 200, 60 * 60_000);
  if (!allowed) return rateLimitResponse({ limit: 200, windowSecs: 3600 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("No file", 400);
  if (file.size > 5 * 1024 * 1024) return jsonError("Max 5MB", 400);
  const ext = ALLOWED[file.type];
  if (!ext) return jsonError("PNG, JPG, WebP or GIF only", 400);

  const path = `figures/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(FIGURE_BUCKET)
    .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
  if (error) return jsonError(error.message, 500);

  const { data } = await admin.storage.from(FIGURE_BUCKET).createSignedUrl(path, 60 * 60 * 4);
  return Response.json({ path, url: data?.signedUrl ?? null });
}
