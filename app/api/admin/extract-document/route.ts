import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { documentUrl, lessonId } = await req.json();
  if (!documentUrl || !lessonId) return new Response("Missing fields", { status: 400 });

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

  const admin = createAdminClient();
  await admin.from("lessons").update({ document_text: text.slice(0, 20000) }).eq("id", lessonId);

  return Response.json({ ok: true });
}
