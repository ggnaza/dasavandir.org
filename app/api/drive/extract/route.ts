import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOAuthClient } from "@/lib/google-drive";
import { getDriveTokens } from "@/lib/drive-session";
import { google } from "googleapis";
import { cookies } from "next/headers";
import { z } from "zod";

export const runtime = "nodejs";

const EDITOR_ROLES = ["admin", "course_creator", "course_manager"];

const SUPPORTED_MIME_TYPES: Record<string, string> = {
  "application/vnd.google-apps.document": "text/plain",
  "application/vnd.google-apps.presentation": "text/plain",
  "text/plain": "",
};

const extractSchema = z.object({
  fileIds: z.array(z.string().regex(/^[a-zA-Z0-9_-]{1,200}$/)).min(1).max(10),
});

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!EDITOR_ROLES.includes(profile?.role ?? "")) return new Response("Forbidden", { status: 403 });

  const sessionId = cookies().get("drive_session")?.value;
  if (!sessionId) return new Response("Not connected", { status: 401 });

  const token = await getDriveTokens(sessionId, user.id);
  if (!token) return new Response("Not connected", { status: 401 });

  const parsed = extractSchema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });
  const { fileIds } = parsed.data;

  const auth = getOAuthClient();
  auth.setCredentials(token);
  const drive = google.drive({ version: "v3", auth });

  const texts: string[] = [];

  for (const fileId of fileIds) {
    try {
      const { data: meta } = await drive.files.get({ fileId, fields: "name, mimeType" });
      const mimeType = meta.mimeType ?? "";
      const name = meta.name ?? fileId;

      if (mimeType in SUPPORTED_MIME_TYPES) {
        const exportMime = SUPPORTED_MIME_TYPES[mimeType] || "text/plain";

        if (mimeType.startsWith("application/vnd.google-apps")) {
          const res = await drive.files.export({ fileId, mimeType: exportMime }, { responseType: "text" });
          texts.push(`=== ${name} ===\n${res.data}`);
        } else {
          const res = await drive.files.get({ fileId, alt: "media" }, { responseType: "text" });
          texts.push(`=== ${name} ===\n${res.data}`);
        }
      } else if (mimeType === "application/pdf") {
        texts.push(`=== ${name} ===\n[PDF file — content cannot be extracted automatically. Please also paste the text content if needed.]`);
      } else {
        texts.push(`=== ${name} ===\n[File type not supported for extraction: ${mimeType}]`);
      }
    } catch {
      // Skip files that can't be read
    }
  }

  if (!texts.length) return new Response("Could not extract text from selected files", { status: 400 });

  return Response.json({ text: texts.join("\n\n") });
}
