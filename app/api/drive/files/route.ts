import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOAuthClient } from "@/lib/google-drive";
import { getDriveTokens } from "@/lib/drive-session";
import { google } from "googleapis";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const EDITOR_ROLES = ["admin", "course_creator", "course_manager"];
// Only allow alphanumeric Drive IDs or the literal "root"
const FOLDER_ID_RE = /^[a-zA-Z0-9_-]{1,200}$|^root$/;

export async function GET(req: Request) {
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

  const rawFolderId = new URL(req.url).searchParams.get("folderId") ?? "root";
  if (!FOLDER_ID_RE.test(rawFolderId)) return new Response("Invalid folderId", { status: 400 });
  const folderId = rawFolderId;

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
