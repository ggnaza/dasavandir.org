import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAIModel, callLLM } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 120;

const EDITOR_ROLES = ["admin", "course_creator", "course_manager"];

const GOOGLE_DOCS_RE = /^https:\/\/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/;
const GOOGLE_SLIDES_RE = /^https:\/\/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/;

async function extractTextFromFile(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf")) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse/lib/pdf-parse.js");
    const result = await pdfParse(buffer);
    return (result.text?.trim() ?? "").slice(0, 30000);
  }

  if (name.endsWith(".docx")) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mammoth = require("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return (result.value?.trim() ?? "").slice(0, 30000);
  }

  if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv")) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const lines: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      lines.push(`[Sheet: ${sheetName}]`);
      lines.push(XLSX.utils.sheet_to_csv(sheet));
    }
    return lines.join("\n").slice(0, 30000);
  }

  if (name.endsWith(".rtf")) {
    // Strip RTF control codes and return plain text
    const raw = buffer.toString("latin1");
    const text = raw
      .replace(/\{[^{}]*\}/g, " ")
      .replace(/\\[a-z]+\d*\s?/gi, " ")
      .replace(/[{}\\]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, 30000);
  }

  // Plain text fallback (.txt, .md, etc.)
  return buffer.toString("utf-8").trim().slice(0, 30000);
}

async function extractTextFromUrl(url: string): Promise<string> {
  const docsMatch = url.match(GOOGLE_DOCS_RE);
  if (docsMatch) {
    const res = await fetch(
      `https://docs.google.com/document/d/${docsMatch[1]}/export?format=txt`,
      { cache: "no-store" }
    );
    if (res.ok) return (await res.text()).trim().slice(0, 30000);
    throw new Error(
      "Could not read the Google Doc. Make sure sharing is set to 'Anyone with the link can view'."
    );
  }

  const slidesMatch = url.match(GOOGLE_SLIDES_RE);
  if (slidesMatch) {
    const res = await fetch(
      `https://docs.google.com/presentation/d/${slidesMatch[1]}/export/txt`,
      { cache: "no-store" }
    );
    if (res.ok) return (await res.text()).trim().slice(0, 30000);
    throw new Error(
      "Could not read the Google Slides. Make sure sharing is set to 'Anyone with the link can view'."
    );
  }

  throw new Error("Only Google Docs and Google Slides URLs are supported.");
}

function buildPrompt(language: string, hint: string): string {
  const lang = language === "hy" ? "Armenian (Հայերեն)" : "English";
  return `You are an expert instructional designer. Your job is to turn the provided learning material into a structured online course.
${hint ? `\nContext from the course creator: "${hint}"\n` : ""}
════════════════════════════════════════
ANTI-HALLUCINATION RULES — strictly enforced:
1. Base ALL lesson content EXCLUSIVELY on the provided material. Do NOT add information that is not in the source text.
2. Do NOT invent statistics, research findings, quotes, dates, names, examples, case studies, or claims that are not explicitly present in the material.
3. Do NOT pad lessons with generic filler or common knowledge — if the material doesn't cover something, leave it out.
4. If the material is short, write fewer or shorter lessons rather than filling space with invented content.
5. Every factual statement in the lesson content must be traceable back to the provided material.
════════════════════════════════════════

Output ONLY valid JSON — no markdown, no extra text — with this exact structure:
{
  "title": "Course title",
  "description": "2-3 sentence description of what the course covers",
  "outcomes": ["Specific outcome 1", "Specific outcome 2", "Specific outcome 3"],
  "lessons": [
    {
      "title": "Lesson title",
      "content": "<h2>Section</h2><p>Detailed explanation...</p><ul><li>Point</li></ul>",
      "what_you_learn": "One-sentence key takeaway for this lesson",
      "slides_outline": "Slide 1: [Title]\\nSlide 2: [Heading]\\n- bullet\\n- bullet\\nSlide 3: ...",
      "video_script": "Welcome to [lesson title]. In this lesson we will cover..."
    }
  ]
}

Guidelines:
- Create 5–8 focused lessons that cover the material thoroughly (fewer if material is limited)
- Lesson content: rich HTML using <h2>, <h3>, <p>, <ul>, <li>, <strong> — aim for 400–800 words per lesson, sourced from the material
- Slides outline: 5–8 slides per lesson as plain text (title + bullets), no HTML
- Video script: 2–3 minute spoken narration (300–450 words), natural conversational tone
- All text must be written in ${lang}
- Outcomes: 3–5 specific, measurable statements reflecting what the material actually teaches`;
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!EDITOR_ROLES.includes(profile?.role ?? "")) return new Response("Forbidden", { status: 403 });

  let language = "en";
  let hint = "";
  let materialUrl: string | null = null;
  const textParts: string[] = [];

  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    language = (form.get("language") as string) ?? "en";
    hint = (form.get("hint") as string) ?? "";
    const url = form.get("materialUrl") as string | null;
    const file = form.get("file") as File | null;

    if (url?.trim()) {
      materialUrl = url.trim();
      try {
        textParts.push(await extractTextFromUrl(materialUrl));
      } catch (e: any) {
        return new Response(e.message, { status: 400 });
      }
    }

    if (file) {
      try {
        const fileText = await extractTextFromFile(file);
        if (fileText) textParts.push(fileText);
      } catch {
        return new Response("Could not extract text from the uploaded file.", { status: 400 });
      }
    }

    if (textParts.length === 0) {
      return new Response("No material provided.", { status: 400 });
    }
  } else {
    const body = await req.json();
    language = body.language ?? "en";
    hint = body.hint ?? "";
    if (body.materialUrl?.trim()) {
      materialUrl = body.materialUrl.trim() as string;
      try {
        textParts.push(await extractTextFromUrl(materialUrl));
      } catch (e: any) {
        return new Response(e.message, { status: 400 });
      }
    } else {
      return new Response("No material provided.", { status: 400 });
    }
  }

  const materialText = textParts.join("\n\n---\n\n");

  if (!materialText.trim()) {
    return new Response("The material appears to be empty or could not be read.", { status: 400 });
  }

  const model = await getAIModel();
  const raw = await callLLM(
    model,
    buildPrompt(language, hint),
    `Learning material:\n---\n${materialText}`,
    { maxTokens: 12000, temperature: 0.2, jsonMode: true }
  );

  let parsed: any;
  try {
    parsed = JSON.parse(raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim());
  } catch {
    return new Response("AI returned unexpected output. Please try again.", { status: 500 });
  }

  if (!parsed.title || !Array.isArray(parsed.lessons) || parsed.lessons.length === 0) {
    return new Response("AI returned an incomplete course structure. Please try again.", { status: 500 });
  }

  return Response.json({ ...parsed, materialUrl });
}
