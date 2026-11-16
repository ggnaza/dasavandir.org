import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOAuthClient } from "@/lib/google-drive";
import { getDriveTokens } from "@/lib/drive-session";
import { google } from "googleapis";
import { cookies } from "next/headers";
import { assertCourseOwner } from "@/lib/assert-course-owner";

export const runtime = "nodejs";

const ALLOWED_HOSTS = ["docs.google.com", "drive.google.com"];

function isAllowedUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    if (ALLOWED_HOSTS.some((h) => hostname === h || hostname.endsWith("." + h))) return true;
    // Allow Supabase storage URLs (uploaded PDFs)
    if (hostname.endsWith(".supabase.co")) return true;
    return false;
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

function isSupabaseStorage(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".supabase.co");
  } catch { return false; }
}

// Extract bucket + path from a Supabase storage public URL
// e.g. https://xxx.supabase.co/storage/v1/object/public/lesson-documents/abc/file.pdf
function parseSupabasePath(url: string): { bucket: string; path: string } | null {
  try {
    const { pathname } = new URL(url);
    // matches /storage/v1/object/public/<bucket>/<rest>
    const m = pathname.match(/^\/storage\/v1\/object\/(?:public|authenticated)\/([^/]+)\/(.+)$/);
    if (!m) return null;
    return { bucket: m[1], path: m[2] };
  } catch { return null; }
}

type ExtractResult = { text: string } | { error: string; status: number };
const fail = (error: string, init: { status: number }): ExtractResult => ({ error, status: init.status });

async function extractOne(
  documentUrl: string,
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<ExtractResult> {
  if (!isAllowedUrl(documentUrl)) {
    return fail("URL not allowed — only Google Drive, Google Docs, and uploaded files are supported", { status: 400 });
  }

  let text = "";

  // Google Docs: use Drive API with OAuth to export as plain text
  if (isGoogleDoc(documentUrl)) {
    const fileId = extractFileId(documentUrl);
    if (!fileId) return fail("Could not parse Google Docs URL", { status: 400 });

    const sessionId = cookies().get("drive_session")?.value;
    if (!sessionId) return fail("Not connected to Google Drive", { status: 401 });

    const token = await getDriveTokens(sessionId, userId);
    if (!token) return fail("Not connected to Google Drive", { status: 401 });

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
      return fail("Could not extract Google Doc — make sure you are connected to Drive and the file is shared", { status: 400 });
    }
  } else if (isSupabaseStorage(documentUrl)) {
    // Uploaded PDF — download via admin storage client (bypasses public URL auth)
    const parsed = parseSupabasePath(documentUrl);
    if (!parsed) return fail("Could not parse storage URL", { status: 400 });
    try {
      const { data: blob, error: dlErr } = await admin.storage
        .from(parsed.bucket)
        .download(parsed.path);
      if (dlErr || !blob) return fail("Could not download file from storage", { status: 400 });
      const buffer = Buffer.from(await blob.arrayBuffer());
      const pdfParse = require("pdf-parse/lib/pdf-parse.js");
      const result = await pdfParse(buffer);
      text = result.text?.trim() ?? "";
    } catch {
      return fail("Could not extract PDF text", { status: 400 });
    }
  } else {
    // PDF from external URL (e.g. Google Drive direct link)
    try {
      const res = await fetch(documentUrl);
      const buffer = Buffer.from(await res.arrayBuffer());
      const pdfParse = require("pdf-parse/lib/pdf-parse.js");
      const data = await pdfParse(buffer);
      text = data.text?.trim() ?? "";
    } catch {
      return fail("Could not extract PDF text", { status: 400 });
    }
  }

  return { text };
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "course_creator", "course_manager", "space_manager"].includes(profile?.role ?? "")) {
    return new Response("Forbidden", { status: 403 });
  }

  const body = await req.json();
  const lessonId: string | undefined = body.lessonId;
  // documentUrls (all of a lesson's documents) or the legacy single documentUrl.
  const urls: string[] = Array.isArray(body.documentUrls)
    ? body.documentUrls.filter((u: unknown): u is string => typeof u === "string" && u.length > 0)
    : body.documentUrl ? [body.documentUrl] : [];
  if (!lessonId || (!Array.isArray(body.documentUrls) && urls.length === 0)) {
    return new Response("Missing fields", { status: 400 });
  }

  const { data: lesson } = await admin.from("lessons").select("course_id").eq("id", lessonId).single();
  if (!lesson?.course_id) return new Response("Lesson not found", { status: 404 });
  const ownerErr = await assertCourseOwner(lesson.course_id, user.id);
  if (ownerErr) return ownerErr;

  if (urls.length === 0) {
    await admin.from("lessons").update({ document_text: null }).eq("id", lessonId);
    return Response.json({ ok: true });
  }

  const texts: string[] = [];
  let lastError: { error: string; status: number } | null = null;
  for (const url of urls) {
    const r = await extractOne(url, admin, user.id);
    if ("text" in r) {
      if (r.text) texts.push(urls.length > 1 ? `[Document ${texts.length + 1}]\n${r.text}` : r.text);
    } else {
      lastError = r;
    }
  }

  if (!texts.length) {
    return new Response(lastError?.error ?? "No text found in document", { status: lastError?.status ?? 400 });
  }
  const text = texts.join("\n\n");

  await admin.from("lessons").update({ document_text: text.slice(0, 20000) }).eq("id", lessonId);

  return Response.json({ ok: true });
}
