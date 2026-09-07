import { getGnahatumUser, requireAuth } from "@/lib/gnahatum/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  SCAN_BUCKET,
  isAllowedScanType,
  scanObjectPath,
} from "@/lib/gnahatum/storage";

/**
 * Mint a short-lived signed URL the browser uses to upload one scan directly
 * to Supabase Storage, bypassing Vercel's 4.5MB request body limit.
 *
 * Only the object key is decided here — it is derived from the authenticated
 * caller's id, never from anything the client sends, so a caller cannot mint a
 * URL that writes into someone else's namespace.
 */
export async function POST(request: Request) {
  const user = await getGnahatumUser();
  const denied = requireAuth(user);
  if (denied) return denied;

  let body: { content_type?: string; batch_id?: string };
  try {
    body = (await request.json()) as { content_type?: string; batch_id?: string };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const contentType = body.content_type ?? "";
  if (!isAllowedScanType(contentType)) {
    return Response.json(
      { error: "Unsupported file type — upload a PDF or an image" },
      { status: 400 },
    );
  }

  // A client-supplied batch id only groups objects; keep it to a safe shape so
  // it cannot climb out of the prefix.
  const batchId = (body.batch_id ?? "").replace(/[^a-zA-Z0-9-]/g, "");
  if (!batchId) {
    return Response.json({ error: "batch_id is required" }, { status: 400 });
  }

  const path = scanObjectPath(user!.id, batchId, contentType);

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(SCAN_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error("[gnahatum/upload-url] could not sign upload", error?.message);
    return Response.json(
      { error: error?.message ?? "Could not create an upload URL" },
      { status: 500 },
    );
  }

  return Response.json({ path: data.path, token: data.token });
}
