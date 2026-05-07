import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOAuthClient } from "@/lib/google-drive";
import { getDriveTokens } from "@/lib/drive-session";
import { google } from "googleapis";
import { cookies } from "next/headers";

export const runtime = "nodejs";

function extractFileId(url: string): string | null {
  try {
    const match = new URL(url).pathname.match(/\/d\/([a-zA-Z0-9_-]+)/);
    return match?.[1] ?? null;
  } catch { return null; }
}

const ALLOWED_HOSTS = ["docs.google.com", "drive.google.com"];

function isAllowedUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return ALLOWED_HOSTS.some((h) => hostname === h || hostname.endsWith("." + h));
  } catch {
    return false;
  }
}

function extractTextFromShape(shape: any): string {
  return (shape?.text?.textElements ?? [])
    .map((te: any) => te.textRun?.content ?? "")
    .join("")
    .trim();
}

function buildStructuredSlidesText(presentation: any): string {
  const slides: string[] = [];

  for (let i = 0; i < (presentation.slides ?? []).length; i++) {
    const slide = presentation.slides[i];
    const lines: string[] = [`[Slide ${i + 1}]`];

    for (const el of slide.pageElements ?? []) {
      const text = extractTextFromShape(el.shape);
      if (text) lines.push(text);
    }

    // Speaker notes
    const notesPage = slide.slideProperties?.notesPage;
    if (notesPage) {
      const notesText = (notesPage.pageElements ?? [])
        .map((el: any) => extractTextFromShape(el.shape))
        .filter(Boolean)
        .join(" ")
        .trim();
      if (notesText) lines.push(`Notes: ${notesText}`);
    }

    if (lines.length > 1) slides.push(lines.join("\n"));
  }

  return slides.join("\n\n");
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

  const { slidesUrl, lessonId } = await req.json();
  if (!slidesUrl || !lessonId) return new Response("Missing fields", { status: 400 });

  if (!isAllowedUrl(slidesUrl)) {
    return new Response("URL not allowed — only Google Slides links are supported", { status: 400 });
  }

  const fileId = extractFileId(slidesUrl);
  if (!fileId) return new Response("Could not parse Google URL", { status: 400 });

  const sessionId = cookies().get("drive_session")?.value;
  if (!sessionId) return new Response("Not connected to Google Drive", { status: 401 });

  const token = await getDriveTokens(sessionId, user.id);
  if (!token) return new Response("Not connected to Google Drive", { status: 401 });

  const auth = getOAuthClient();
  auth.setCredentials(token);

  let text = "";

  // Try Slides API first — gives structured per-slide content with speaker notes
  try {
    const slidesApi = google.slides({ version: "v1", auth });
    const res = await slidesApi.presentations.get({ presentationId: fileId });
    text = buildStructuredSlidesText(res.data).trim();
  } catch {
    // Fallback to Drive text export if Slides API fails
    try {
      const drive = google.drive({ version: "v3", auth });
      const res = await drive.files.export(
        { fileId, mimeType: "text/plain" },
        { responseType: "text" }
      );
      text = (res.data as string).trim();
    } catch {
      return new Response("Could not extract — make sure you are connected to Drive and the file is shared", { status: 400 });
    }
  }

  if (!text) return new Response("No text found", { status: 400 });

  await admin.from("lessons").update({ slides_text: text }).eq("id", lessonId);

  return Response.json({ text });
}
