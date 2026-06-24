import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { z } from "zod";
import { getAIModel, callLLM } from "@/lib/llm";

const schema = z.object({
  lesson_id: z.string().uuid(),
  course_id: z.string().uuid(),
  count: z.number().int().min(1).max(20).optional().default(5),
  sources: z.object({
    content: z.boolean(),
    slides: z.boolean(),
    uploads: z.boolean(),
  }).optional().default({ content: true, slides: true, uploads: true }),
  adHocText: z.string().max(30000).optional(),
});

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "course_creator"].includes(profile.role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const { allowed } = await checkRateLimit(`qbank-generate:${user.id}`, 10, 60_000);
  if (!allowed) return rateLimitResponse({ limit: 10, windowSecs: 60 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const { lesson_id, course_id, count, sources, adHocText } = parsed.data;

  if (!sources.content && !sources.slides && !sources.uploads && !adHocText?.trim()) {
    return new Response("Select at least one content source to generate questions from.", { status: 400 });
  }

  const ownerErr = await assertCourseOwner(course_id, user.id);
  if (ownerErr) return ownerErr;

  const admin = createAdminClient();

  const { data: lesson } = await admin
    .from("lessons")
    .select("title, content, slides_text, document_text")
    .eq("id", lesson_id)
    .single();

  if (!lesson) return new Response("Lesson not found", { status: 404 });

  const contentText = sources.content ? (lesson.content ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
  const slidesText = sources.slides ? (lesson.slides_text ?? "").trim() : "";
  const documentText = sources.uploads ? (lesson.document_text ?? "").trim() : "";

  let resourcesText = "";
  if (sources.uploads) {
    const { data: resources } = await admin
      .from("course_resources")
      .select("title, extracted_text")
      .eq("course_id", course_id)
      .order("created_at");
    resourcesText = (resources ?? [])
      .filter((r) => r.extracted_text?.trim())
      .map((r) => `### ${r.title}\n${r.extracted_text!.trim()}`)
      .join("\n\n")
      .slice(0, 6000);
  }

  const text = [
    contentText,
    slidesText,
    documentText,
    resourcesText ? `Course supplementary resources:\n${resourcesText}` : "",
    adHocText?.trim() ? `Additional uploaded materials:\n${adHocText.trim()}` : "",
  ].filter(Boolean).join("\n\n").slice(0, 18000);

  if (!text.trim()) return new Response("The selected sources have no text content. Try selecting different sources or extracting slides/documents first.", { status: 422 });

  const model = await getAIModel();
  const raw = await callLLM(
    model,
    `You are an expert educator creating multiple-choice quiz questions.

STRICT RULES:
1. Generate questions ONLY from the lesson content provided — do not invent topics, facts, or scenarios not present in the material.
2. Do NOT add general-knowledge questions unrelated to this specific lesson.
3. Each question must test genuine understanding of the material, not just surface recall.
4. All 4 answer options must be plausible; only one must be correct.
5. Return ONLY valid JSON — no markdown, no explanation.`,
    `Generate exactly ${count} multiple-choice questions for the lesson "${lesson.title}".

Lesson content (your ONLY source of truth):
---
${text}
---

Return a JSON array of exactly ${count} objects:
[{"question":"...","options":["A","B","C","D"],"correct":2}]

"correct" is the 0-based index of the correct answer. Return ONLY the JSON array.`,
    { maxTokens: 2000, temperature: 0.3, jsonMode: true }
  );

  let generated: { question: string; options: string[]; correct: number }[] = [];
  try {
    const p = JSON.parse(raw.replace(/```json|```/g, "").trim());
    generated = Array.isArray(p) ? p : (p.questions ?? p.items ?? Object.values(p)[0] ?? []);
  } catch {
    return new Response("AI returned invalid JSON. Please try again.", { status: 500 });
  }

  if (!Array.isArray(generated) || generated.length === 0) {
    return new Response("AI returned no questions. Please try again.", { status: 500 });
  }

  const rows = generated
    .filter((q) => q.question && Array.isArray(q.options) && q.options.length === 4 && typeof q.correct === "number")
    .map((q) => ({
      course_id,
      lesson_id,
      question: q.question,
      options: q.options,
      correct: q.correct,
    }));

  if (rows.length === 0) return new Response("AI returned invalid question format. Please try again.", { status: 500 });

  const { error } = await admin.from("question_bank").insert(rows);
  if (error) {
    console.error("[question-bank/generate]", error);
    return new Response("Failed to save questions", { status: 500 });
  }

  return Response.json({ added: rows.length });
}
