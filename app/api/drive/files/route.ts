import { createClient } from "@/lib/supabase/server";
import { getOAuthClient, tokenFromCookie } from "@/lib/google-drive";
import { google } from "googleapis";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const token = tokenFromCookie(cookies().get("google_drive_token")?.value);
  if (!token) return new Response("Not connected", { status: 401 });

  const folderId = new URL(req.url).searchParams.get("folderId") ?? "root";

  const auth = getOAuthClient();
  auth.setCredentials(token);

  const drive = google.drive({ version: "v3", auth });

  const { data } = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id, name, mimeType, modifiedTime)",
    orderBy: "folder,name",
    pageSize: 100,
  });

  // Get folder name for breadcrumb
  let folderName = "My Drive";
  if (folderId !== "root") {
    const { data: folder } = await drive.files.get({ fileId: folderId, fields: "name" });
    folderName = folder.name ?? folderId;
  }

  return Response.json({ files: data.files ?? [], folderName });
}
