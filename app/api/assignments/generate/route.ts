import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { z } from "zod";
import { getAIModel, callLLM } from "@/lib/llm";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EDITOR_ROLES = ["admin", "course_creator", "course_manager"];

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !EDITOR_ROLES.includes(profile.role)) return new Response("Forbidden", { status: 403 });

  const { allowed } = await checkRateLimit(`assign-gen:${user.id}`, 10, 60 * 60_000);
  if (!allowed) return rateLimitResponse({ limit: 10, windowSecs: 3600 });

  const { lessonId } = await req.json();
  if (!lessonId || !UUID_RE.test(lessonId)) return new Response("Missing lessonId", { status: 400 });

  const { data: lesson } = await admin
    .from("lessons")
    .select("title, content, slides_text, document_text, video_url, course_id")
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

  // Build lesson text from pre-extracted DB fields
  const contentText = (lesson.content ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const slidesText = (lesson.slides_text ?? "").trim();
  const documentText = (lesson.document_text ?? "").trim();

  const lessonText = [
    `Lesson title: ${lesson.title}`,
    contentText ? `Lesson content:\n${contentText}` : "",
    slidesText ? `Slide content:\n${slidesText}` : "",
    documentText ? `Document content:\n${documentText}` : "",
    lesson.video_url ? `(This lesson also includes a video — AI cannot read video content)` : "",
  ].filter(Boolean).join("\n\n").slice(0, 12000);

  // Load course-level resources
  const { data: resources } = await admin
    .from("course_resources")
    .select("title, extracted_text")
    .eq("course_id", lesson.course_id)
    .order("created_at");

  const resourcesText = (resources ?? [])
    .filter((r) => r.extracted_text?.trim())
    .map((r) => `### ${r.title}\n${r.extracted_text!.trim()}`)
    .join("\n\n")
    .slice(0, 6000);

  const fullContext = [
    lessonText,
    resourcesText ? `Course supplementary resources:\n${resourcesText}` : "",
  ].filter(Boolean).join("\n\n");

  if (!fullContext.trim() || fullContext.trim() === `Lesson title: ${lesson.title}`) {
    return new Response("Lesson has no text content to generate an assignment from. Please extract slides or documents first.", { status: 400 });
  }

  const model = await getAIModel();

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
- Base the assignment entirely on the lesson material provided — reference specific concepts, terms, or frameworks from the material
- Instructions should use headings and bullet points; include a <table> when comparing/evaluating multiple items is relevant
- Rubric: 3-5 criteria, total points between 50-100
${language ? `- Write everything in ${language}` : "- Match the language of the lesson content"}`;

  const raw = await callLLM(model, systemPrompt, fullContext, { temperature: 0.7, maxTokens: 2000, jsonMode: true });
  try {
    return Response.json(JSON.parse(raw));
  } catch {
    return new Response("AI returned invalid JSON", { status: 500 });
  }
}
