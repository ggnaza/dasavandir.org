import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { z } from "zod";
import OpenAI from "openai";

const schema = z.object({
  lesson_id: z.string().uuid(),
  course_id: z.string().uuid(),
  count: z.number().int().min(1).max(20).optional().default(5),
});

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "course_creator"].includes(profile.role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const { allowed } = await checkRateLimit(`qbank-generate:${user.id}`, 10, 60_000);
  if (!allowed) return rateLimitResponse({ limit: 10, windowSecs: 60 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const { lesson_id, course_id, count } = parsed.data;

  const ownerErr = await assertCourseOwner(course_id, user.id);
  if (ownerErr) return ownerErr;

  const admin = createAdminClient();

  const { data: lesson } = await admin
    .from("lessons")
    .select("title, content, slides_text, document_text")
    .eq("id", lesson_id)
    .single();

  if (!lesson) return new Response("Lesson not found", { status: 404 });

  const text = [
    (lesson.content ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    (lesson.slides_text ?? "").trim(),
    (lesson.document_text ?? "").trim(),
  ].filter(Boolean).join("\n\n").slice(0, 5000);

  if (!text) return new Response("This lesson has no text content to generate questions from.", { status: 422 });

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 30_000 });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You generate multiple-choice quiz questions based on lesson content. Always return valid JSON only.`,
      },
      {
        role: "user",
        content: `Generate exactly ${count} multiple-choice questions based on this lesson titled "${lesson.title}".

Lesson content:
---
${text}
---

Return a JSON array of exactly ${count} objects, each with:
- "question": string
- "options": array of exactly 4 strings
- "correct": integer 0-3 (index of correct option)

Example: [{"question":"...","options":["A","B","C","D"],"correct":2}]

Return ONLY the JSON array, nothing else.`,
      },
    ],
    max_tokens: 2000,
    response_format: { type: "json_object" },
  });

  let generated: { question: string; options: string[]; correct: number }[] = [];
  try {
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const p = JSON.parse(raw);
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
