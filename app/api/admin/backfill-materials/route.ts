import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOAuthClient } from "@/lib/google-drive";
import { getDriveTokens } from "@/lib/drive-session";
import { google } from "googleapis";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const maxDuration = 60;

function extractFileId(url: string): string | null {
  try {
    const match = new URL(url).pathname.match(/\/d\/([a-zA-Z0-9_-]+)/);
    return match?.[1] ?? null;
  } catch { return null; }
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return new Response("Forbidden", { status: 403 });

  // Get Drive connection
  const sessionId = cookies().get("drive_session")?.value;
  const token = sessionId ? await getDriveTokens(sessionId, user.id) : null;
  let drive: any = null;
  if (token) {
    const auth = getOAuthClient();
    auth.setCredentials(token);
    drive = google.drive({ version: "v3", auth });
  }

  // Load all lessons with slides or documents
  const { data: lessons } = await admin
    .from("lessons")
    .select("id, title, slides_url, document_url, slides_text, document_text");

  const results: { title: string; slides: string; pdf: string }[] = [];

  for (const lesson of lessons ?? []) {
    let slidesStatus = "skipped";
    let pdfStatus = "skipped";

    // Extract Google Slides/Docs/Sheets
    if (lesson.slides_url && lesson.slides_url.includes("docs.google.com")) {
      if (!drive) {
        slidesStatus = "no Drive connection";
      } else {
        const fileId = extractFileId(lesson.slides_url);
        if (fileId) {
          try {
            const res = await drive.files.export({ fileId, mimeType: "text/plain" }, { responseType: "text" });
            const text = (res.data as string).trim();
            if (text) {
              await admin.from("lessons").update({ slides_text: text }).eq("id", lesson.id);
              slidesStatus = "ok";
            } else {
              slidesStatus = "empty";
            }
          } catch {
            slidesStatus = "error";
          }
        } else {
          slidesStatus = "bad URL";
        }
      }
    }

    // Extract PDF
    if (lesson.document_url) {
      try {
        const res = await fetch(lesson.document_url);
        const buffer = Buffer.from(await res.arrayBuffer());
        const pdfParse = require("pdf-parse");
        const data = await pdfParse(buffer);
        const text = data.text?.trim() ?? "";
        if (text) {
          await admin.from("lessons").update({ document_text: text.slice(0, 20000) }).eq("id", lesson.id);
          pdfStatus = "ok";
        } else {
          pdfStatus = "empty";
        }
      } catch {
        pdfStatus = "error";
      }
    }

    results.push({ title: lesson.title, slides: slidesStatus, pdf: pdfStatus });
  }

  return Response.json({ results });
}
