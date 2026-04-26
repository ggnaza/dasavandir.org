import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";

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
  const match = url.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? null;
}

async function fetchGoogleSlidesText(url: string): Promise<string | null> {
  try {
    const u = new URL(url);
    if (u.hostname !== "docs.google.com" || !u.pathname.includes("/presentation/d/")) return null;
  } catch {
    return null;
  }
  const id = extractGoogleSlidesId(url);
  if (!id) return null;
  try {
    const exportUrl = `https://docs.google.com/presentation/d/${id}/export/txt`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    const res = await fetch(exportUrl, { cache: "no-store", signal: controller.signal });
    clearTimeout(timer);
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

  const { lessonId } = await req.json();
  if (!lessonId) return new Response("Missing lessonId", { status: 400 });

  const { data: lesson } = await admin
    .from("lessons")
    .select("title, content, slides_url, video_url, document_url, course_id")
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
    parts.push(`This lesson also includes a video (note its existence but you cannot read it): ${lesson.video_url}`);
  }

  if (lesson.document_url) {
    parts.push(`This lesson includes an uploaded PDF document.`);
  }

  const hasContent = lesson.content || lesson.slides_url || lesson.video_url || lesson.document_url;
  if (!hasContent) {
    return new Response("Lesson has no content to generate an assignment from", { status: 400 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 25_000 });

  const systemPrompt = `You are an instructional designer. Given lesson material, generate a practical assignment for learners.

Return a JSON object with exactly this shape:
{
  "title": "Short assignment title",
  "instructions": "HTML string — use <h2>, <p>, <ul>/<li>, <table> for rich formatting. Be specific and actionable. 150-300 words.",
  "rubric": [
    { "criterion": "Criterion name", "description": "What full marks looks like", "max_points": 20 }
  ]
}

Rules:
- Base the assignment entirely on the lesson material provided
- Instructions should use headings and bullet points; include a <table> when comparing/evaluating multiple items is relevant
- Rubric: 3-5 criteria, total points between 50-100
${language ? `- Write everything in ${language}` : "- Match the language of the lesson content"}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: parts.join("\n\n") },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const raw = completion.choices[0].message.content ?? "{}";
  try {
    return Response.json(JSON.parse(raw));
  } catch {
    return new Response("AI returned invalid JSON", { status: 500 });
  }
}
