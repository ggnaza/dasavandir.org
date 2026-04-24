import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import OpenAI from "openai";
import pdfParse from "pdf-parse";

export const runtime = "nodejs";

function htmlToText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function extractGoogleSlidesId(url: string): string | null {
  try {
    const match = url.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

async function fetchGoogleSlidesText(url: string): Promise<string | null> {
  const id = extractGoogleSlidesId(url);
  if (!id) return null;
  try {
    const exportUrl = `https://docs.google.com/presentation/d/${id}/export/txt`;
    const res = await fetch(exportUrl, { cache: "no-store" });
    if (!res.ok) return null;
    const text = await res.text();
    return text.slice(0, 6000).trim() || null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return new Response("Forbidden", { status: 403 });

  const { lessonId, count = 5 } = await req.json();
  if (!lessonId) return new Response("Missing lessonId", { status: 400 });

  const { data: lesson } = await admin
    .from("lessons")
    .select("title, content, video_url, slides_url, document_url, course_id")
    .eq("id", lessonId)
    .single();

  if (!lesson) return new Response("Lesson not found", { status: 404 });

  const { data: course } = await admin
    .from("courses")
    .select("language")
    .eq("id", lesson.course_id)
    .single();

  const languageMap: Record<string, string> = { hy: "Armenian", en: "English" };
  const language = languageMap[course?.language ?? ""] ?? null;

  const parts: string[] = [];
  parts.push(`Lesson title: ${lesson.title}`);

  if (lesson.content) {
    parts.push(`Lesson content:\n${htmlToText(lesson.content).slice(0, 4000)}`);
  }

  if (lesson.slides_url) {
    const slidesText = await fetchGoogleSlidesText(lesson.slides_url);
    if (slidesText) {
      parts.push(`Presentation slides text:\n${slidesText}`);
    } else {
      parts.push(`This lesson includes a presentation: ${lesson.slides_url}`);
    }
  }

  if (lesson.video_url) {
    parts.push(`This lesson also includes a video (you cannot read it, but note its existence): ${lesson.video_url}`);
  }

  if (lesson.document_url) {
    try {
      const pdfRes = await fetch(lesson.document_url, { cache: "no-store" });
      if (pdfRes.ok) {
        const buffer = Buffer.from(await pdfRes.arrayBuffer());
        const parsed = await pdfParse(buffer);
        const text = parsed.text.slice(0, 6000).trim();
        if (text) parts.push(`Uploaded document (PDF) text:\n${text}`);
      }
    } catch {
      // PDF extraction failed — skip silently
    }
  }

  // Only have the title and nothing else
  const hasContent = lesson.content || lesson.slides_url || lesson.video_url || lesson.document_url;
  if (!hasContent) {
    return new Response("Lesson has no content to generate questions from", { status: 400 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.7,
    messages: [
      {
        role: "system",
        content: `You are an expert educator creating multiple-choice quiz questions.
Generate exactly ${count} questions based strictly on the lesson material provided — do not invent topics not covered in the material.
Each question must have 4 answer options and exactly one correct answer.
Questions should test genuine understanding, not just memorization.
${language
  ? `IMPORTANT: You MUST write ALL questions and answer options in ${language}. Do not use any other language.`
  : `IMPORTANT: Detect the language of the lesson content and generate ALL questions and answer options in that same language.`
}
Return ONLY valid JSON — no markdown, no explanation.`,
      },
      {
        role: "user",
        content: `${parts.join("\n\n")}

Return this exact JSON structure:
{
  "questions": [
    {
      "question": "question text",
      "options": ["option A", "option B", "option C", "option D"],
      "correct": 0
    }
  ]
}

The "correct" field is the 0-based index of the correct option.`,
      },
    ],
  });

  const raw = completion.choices[0].message.content ?? "";
  try {
    const json = JSON.parse(raw.replace(/```json|```/g, "").trim());
    return Response.json({ questions: json.questions });
  } catch {
    return new Response("AI returned invalid response. Please try again.", { status: 500 });
  }
}
