import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return new Response("Invalid form data", { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) return new Response("No file provided", { status: 400 });
  if (file.size > MAX_BYTES) return new Response("File exceeds 10 MB limit", { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();
  let text = "";

  try {
    if (name.endsWith(".pdf")) {
      const pdfParse = require("pdf-parse/lib/pdf-parse.js");
      const result = await pdfParse(buffer);
      text = result.text?.trim() ?? "";
    } else if (name.endsWith(".docx") || name.endsWith(".doc")) {
      const mammoth = require("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      text = result.value?.trim() ?? "";
    } else if (name.endsWith(".txt")) {
      text = buffer.toString("utf-8").trim();
    } else {
      return new Response("Unsupported file type. Use PDF, DOCX, DOC, or TXT.", { status: 400 });
    }
  } catch {
    return new Response(`Could not read "${file.name}". Make sure it is not encrypted.`, { status: 400 });
  }

  if (!text) return new Response(`No text found in "${file.name}".`, { status: 400 });

  return Response.json({ text: text.slice(0, 15_000), name: file.name });
}
