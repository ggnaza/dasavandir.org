import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOAuthClient } from "@/lib/google-drive";
import { getDriveTokens } from "@/lib/drive-session";
import { google } from "googleapis";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const ALLOWED_HOSTS = ["docs.google.com", "drive.google.com"];

function isAllowedUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return ALLOWED_HOSTS.some((h) => hostname === h || hostname.endsWith("." + h));
  } catch {
    return false;
  }
}

function extractFileId(url: string): string | null {
  try {
    const match = new URL(url).pathname.match(/\/d\/([a-zA-Z0-9_-]+)/);
    return match?.[1] ?? null;
  } catch { return null; }
}

function isGoogleDoc(url: string): boolean {
  try {
    return new URL(url).hostname === "docs.google.com" && new URL(url).pathname.includes("/document/");
  } catch { return false; }
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "course_creator", "course_manager"].includes(profile?.role ?? "")) {
    return new Response("Forbidden", { status: 403 });
  }

  const { documentUrl, lessonId } = await req.json();
  if (!documentUrl || !lessonId) return new Response("Missing fields", { status: 400 });

  if (!isAllowedUrl(documentUrl)) {
    return new Response("URL not allowed — only Google Drive and Docs links are supported", { status: 400 });
  }

  let text = "";

  // Google Docs: use Drive API with OAuth to export as plain text
  if (isGoogleDoc(documentUrl)) {
    const fileId = extractFileId(documentUrl);
    if (!fileId) return new Response("Could not parse Google Docs URL", { status: 400 });

    const sessionId = cookies().get("drive_session")?.value;
    if (!sessionId) return new Response("Not connected to Google Drive", { status: 401 });

    const token = await getDriveTokens(sessionId, user.id);
    if (!token) return new Response("Not connected to Google Drive", { status: 401 });

    const auth = getOAuthClient();
    auth.setCredentials(token);
    const drive = google.drive({ version: "v3", auth });

    try {
      const res = await drive.files.export(
        { fileId, mimeType: "text/plain" },
        { responseType: "text" }
      );
      text = (res.data as string).trim();
    } catch {
      return new Response("Could not extract Google Doc — make sure you are connected to Drive and the file is shared", { status: 400 });
    }
  } else {
    // PDF from Google Drive: download and parse
    try {
      const res = await fetch(documentUrl);
      const buffer = Buffer.from(await res.arrayBuffer());
      const pdfParse = require("pdf-parse");
      const data = await pdfParse(buffer);
      text = data.text?.trim() ?? "";
    } catch {
      return new Response("Could not extract PDF text", { status: 400 });
    }
  }

  if (!text) return new Response("No text found in document", { status: 400 });

  await admin.from("lessons").update({ document_text: text.slice(0, 20000) }).eq("id", lessonId);

  return Response.json({ ok: true });
}
