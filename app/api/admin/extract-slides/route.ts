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

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { slidesUrl, lessonId } = await req.json();
  if (!slidesUrl || !lessonId) return new Response("Missing fields", { status: 400 });

  const fileId = extractFileId(slidesUrl);
  if (!fileId) return new Response("Could not parse Google URL", { status: 400 });

  const sessionId = cookies().get("drive_session")?.value;
  if (!sessionId) return new Response("Not connected to Google Drive", { status: 401 });

  const token = await getDriveTokens(sessionId, user.id);
  if (!token) return new Response("Not connected to Google Drive", { status: 401 });

  const auth = getOAuthClient();
  auth.setCredentials(token);
  const drive = google.drive({ version: "v3", auth });

  let text = "";
  try {
    const res = await drive.files.export(
      { fileId, mimeType: "text/plain" },
      { responseType: "text" }
    );
    text = (res.data as string).trim();
  } catch {
    return new Response("Could not extract — make sure you are connected to Drive and the file is shared", { status: 400 });
  }

  if (!text) return new Response("No text found", { status: 400 });

  const admin = createAdminClient();
  await admin.from("lessons").update({ slides_text: text }).eq("id", lessonId);

  return Response.json({ text });
}
