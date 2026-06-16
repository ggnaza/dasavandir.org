import { createClient } from "@/lib/supabase/server";
import { getAIModel } from "@/lib/llm";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;          // 10 MB — text extraction (result is tiny)
const MAX_VISION_BYTES = 3 * 1024 * 1024;    // 3 MB — base64 (~4 MB) must fit Vercel's ~4.5 MB body limit
const MIN_USABLE_TEXT = 20;                  // below this we treat the file as image-only

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
  const isPdf = name.endsWith(".pdf");
  const isImage = /\.(png|jpe?g|webp|gif)$/.test(name);
  let text = "";

  try {
    if (isPdf) {
      const pdfParse = require("pdf-parse/lib/pdf-parse.js");
      const result = await pdfParse(buffer);
      text = result.text?.trim() ?? "";
    } else if (name.endsWith(".docx") || name.endsWith(".doc")) {
      const mammoth = require("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      text = result.value?.trim() ?? "";
    } else if (name.endsWith(".txt")) {
      text = buffer.toString("utf-8").trim();
    } else if (isImage) {
      text = ""; // images have no text layer — go straight to vision
    } else {
      return new Response("Unsupported file type. Use PDF, DOCX, DOC, TXT, or an image.", { status: 400 });
    }
  } catch {
    // Extraction crashed (e.g. encrypted/corrupt). For PDFs/images we can still try vision below.
    if (!isPdf && !isImage) {
      return new Response(`Could not read "${file.name}". Make sure it is not encrypted.`, { status: 400 });
    }
    text = "";
  }

  // Usable text layer → send as text (cheaper, works on any model)
  if (text.length >= MIN_USABLE_TEXT) {
    return Response.json({ kind: "text", text: text.slice(0, 15_000), name: file.name });
  }

  // No usable text — fall back to vision (multimodal) for PDFs and images
  if (isPdf || isImage) {
    const model = await getAIModel();
    if (!model.startsWith("gemini-")) {
      return new Response(
        `"${file.name}" has no readable text — it looks like a scanned or image-only file, and the current AI model can't read images. Try a text-based PDF or DOCX, or paste the text directly.`,
        { status: 400 },
      );
    }
    if (file.size > MAX_VISION_BYTES) {
      return new Response(
        `"${file.name}" has no readable text and is too large (max 3 MB) to analyze as an image. Try a smaller file, a text-based PDF/DOCX, or paste the text.`,
        { status: 400 },
      );
    }
    const mimeType = isPdf ? "application/pdf" : (file.type || "image/png");
    return Response.json({ kind: "vision", fileBase64: buffer.toString("base64"), mimeType, name: file.name });
  }

  return new Response(
    `No text found in "${file.name}". It looks like a scanned or image-only file — try a text-based PDF, a DOCX, or paste the text directly.`,
    { status: 400 },
  );
}
