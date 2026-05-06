import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 120;

const EDITOR_ROLES = ["admin", "course_creator", "course_manager"];

const GOOGLE_DOCS_RE = /^https:\/\/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/;
const GOOGLE_SLIDES_RE = /^https:\/\/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/;

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
  return `You are an expert instructional designer. Create a comprehensive online course from the provided learning material.
${hint ? `\nCourse topic hint from the creator: "${hint}"\n` : ""}
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
- Create 5–8 focused lessons that cover the material thoroughly
- Lesson content: detailed HTML using <h2>, <h3>, <p>, <ul>, <li>, <strong> — aim for 400–800 words per lesson
- Slides outline: 5–8 slides per lesson as plain text (title + bullets), no HTML
- Video script: 2–3 minute spoken narration (300–450 words), natural conversational tone
- All text must be written in ${lang}
- Outcomes: 3–5 specific, measurable statements of what learners will achieve`;
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!EDITOR_ROLES.includes(profile?.role ?? "")) return new Response("Forbidden", { status: 403 });

  let materialText = "";
  let language = "en";
  let hint = "";
  let materialUrl: string | null = null;

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
        materialText = await extractTextFromUrl(materialUrl);
      } catch (e: any) {
        return new Response(e.message, { status: 400 });
      }
    } else if (file) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const pdfParse = require("pdf-parse");
        const result = await pdfParse(buffer);
        materialText = (result.text?.trim() ?? "").slice(0, 30000);
      } catch {
        return new Response("Could not extract text from the PDF file.", { status: 400 });
      }
    } else {
      return new Response("No material provided.", { status: 400 });
    }
  } else {
    const body = await req.json();
    language = body.language ?? "en";
    hint = body.hint ?? "";
    if (body.materialUrl?.trim()) {
      materialUrl = body.materialUrl.trim() as string;
      try {
        materialText = await extractTextFromUrl(materialUrl);
      } catch (e: any) {
        return new Response(e.message, { status: 400 });
      }
    } else {
      return new Response("No material provided.", { status: 400 });
    }
  }

  if (!materialText.trim()) {
    return new Response("The material appears to be empty or could not be read.", { status: 400 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: buildPrompt(language, hint) },
      { role: "user", content: `Learning material:\n---\n${materialText}` },
    ],
    response_format: { type: "json_object" },
    max_tokens: 8000,
  });

  const raw = completion.choices[0]?.message?.content ?? "";

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return new Response("AI returned unexpected output. Please try again.", { status: 500 });
  }

  if (!parsed.title || !Array.isArray(parsed.lessons) || parsed.lessons.length === 0) {
    return new Response("AI returned an incomplete course structure. Please try again.", { status: 500 });
  }

  return Response.json({ ...parsed, materialUrl });
}
