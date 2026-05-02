import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

export async function POST(req: Request) {
  // Auth + role check BEFORE any external network call
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
  try {
    const res = await fetch(documentUrl);
    const buffer = Buffer.from(await res.arrayBuffer());
    const pdfParse = require("pdf-parse");
    const data = await pdfParse(buffer);
    text = data.text?.trim() ?? "";
  } catch {
    return new Response("Could not extract PDF text", { status: 400 });
  }

  if (!text) return new Response("No text found in document", { status: 400 });

  await admin.from("lessons").update({ document_text: text.slice(0, 20000) }).eq("id", lessonId);

  return Response.json({ ok: true });
}
