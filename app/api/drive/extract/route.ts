import { createClient } from "@/lib/supabase/server";
import { getOAuthClient, tokenFromCookie } from "@/lib/google-drive";
import { google } from "googleapis";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const SUPPORTED_MIME_TYPES: Record<string, string> = {
  "application/vnd.google-apps.document": "text/plain",
  "application/vnd.google-apps.presentation": "text/plain",
  "text/plain": "",
};

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const token = tokenFromCookie(cookies().get("google_drive_token")?.value);
  if (!token) return new Response("Not connected", { status: 401 });

  const { fileIds } = await req.json();
  if (!fileIds?.length) return new Response("No files selected", { status: 400 });

  const auth = getOAuthClient();
  auth.setCredentials(token);
  const drive = google.drive({ version: "v3", auth });

  const texts: string[] = [];

  for (const fileId of fileIds.slice(0, 10)) {
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
