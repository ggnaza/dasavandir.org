import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_FILES = 5;
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB per file

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "course_creator", "course_manager"].includes(profile?.role ?? "")) {
    return new Response("Forbidden", { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return new Response("Invalid form data", { status: 400 });
  }

  const files = formData.getAll("files") as File[];
  if (!files.length) return new Response("No files provided", { status: 400 });
  if (files.length > MAX_FILES) return new Response(`Maximum ${MAX_FILES} files allowed`, { status: 400 });

  const results: Array<{ name: string; text: string }> = [];

  for (const file of files) {
    if (file.size > MAX_BYTES) {
      return new Response(`File "${file.name}" exceeds 10 MB limit`, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const name = file.name.toLowerCase();
    let text = "";

    try {
      if (name.endsWith(".pdf")) {
        const pdfParse = require("pdf-parse/lib/pdf-parse.js");
        const result = await pdfParse(buffer);
        text = result.text?.trim() ?? "";
      } else if (name.endsWith(".docx")) {
        const mammoth = require("mammoth");
        const result = await mammoth.extractRawText({ buffer });
        text = result.value?.trim() ?? "";
      } else if (name.endsWith(".doc")) {
        // .doc is legacy binary format — mammoth handles most cases
        const mammoth = require("mammoth");
        const result = await mammoth.extractRawText({ buffer });
        text = result.value?.trim() ?? "";
      } else if (name.endsWith(".txt")) {
        text = buffer.toString("utf-8").trim();
      } else {
        return new Response(`Unsupported file type: ${file.name}. Use PDF, DOCX, DOC, or TXT.`, { status: 400 });
      }
    } catch {
      return new Response(`Could not extract text from "${file.name}". Make sure it is not encrypted.`, { status: 400 });
    }

    if (!text) {
      return new Response(`No text found in "${file.name}".`, { status: 400 });
    }

    results.push({ name: file.name, text: text.slice(0, 15000) });
  }

  return Response.json({ results });
}
