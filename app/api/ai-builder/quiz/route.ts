import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildLessonContext } from "@/lib/lesson-ai-context";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { z } from "zod";
import { getAIModel, callLLM } from "@/lib/llm";

export const runtime = "nodejs";

const schema = z.object({
  lessonId: z.string().uuid(),
  count: z.number().int().min(1).max(20).optional().default(5),
  chapterTitle: z.string().max(200).optional(),
  chapterStart: z.number().int().min(0).optional(),
  chapterEnd: z.number().int().min(0).optional(),
});

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!profile) return new Response("Unauthorized", { status: 401 });
  if (profile.role !== "admin") return new Response("Forbidden", { status: 403 });

  const { allowed } = await checkRateLimit(`quiz-gen:${user.id}`, 10, 60 * 60_000);
  if (!allowed) return rateLimitResponse({ limit: 10, windowSecs: 3600 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const { lessonId, count, chapterTitle, chapterStart, chapterEnd } = parsed.data;

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

  const { parts, warnings } = await buildLessonContext(lesson);

  if (chapterTitle) {
    const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    parts.splice(1, 0, `Focus on chapter: "${chapterTitle}" (${fmt(chapterStart ?? 0)} – ${fmt(chapterEnd ?? 0)}). Generate questions specifically about the content in this segment.`);
  }

  const hasContent = lesson.content || lesson.slides_url || lesson.video_url || lesson.document_url;
  if (!hasContent) {
    return new Response("Lesson has no content to generate questions from", { status: 400 });
  }

  const model = await getAIModel();

  const systemPrompt = `You are an expert educator creating multiple-choice quiz questions.
Generate exactly ${count} questions based strictly on the lesson material provided — do not invent topics not covered in the material.
Each question must have 4 answer options and exactly one correct answer.
Questions should test genuine understanding, not just memorization.
${language
  ? `IMPORTANT: You MUST write ALL questions and answer options in ${language}. Do not use any other language.`
  : `IMPORTANT: Detect the language of the lesson content and generate ALL questions and answer options in that same language.`
}
Return ONLY valid JSON — no markdown, no explanation.`;

  const userMessage = `${parts.join("\n\n")}

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

The "correct" field is the 0-based index of the correct option.`;

  try {
    const raw = await callLLM(model, systemPrompt, userMessage, { temperature: 0.7, maxTokens: 2000, jsonMode: true });
    try {
      const json = JSON.parse(raw.replace(/```json|```/g, "").trim());
      return Response.json({ questions: json.questions, warnings });
    } catch {
      return new Response("AI returned invalid response. Please try again.", { status: 500 });
    }
  } catch {
    return new Response("Failed to generate questions. Please try again.", { status: 500 });
  }
}
