import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getAIModel } from "@/lib/llm";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const schema = z.object({
  courseId: z.string().uuid(),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(10_000),
  })).max(100),
});

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (!profile) return new Response("Unauthorized", { status: 401 });
  if (!["admin", "course_creator", "course_manager"].includes(profile.role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const { allowed } = await checkRateLimit(`creator-coach:${user.id}`, 30, 60 * 60_000);
  if (!allowed) return rateLimitResponse({ limit: 30, windowSecs: 3600 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });
  const { courseId, messages } = parsed.data;

  // Load course info
  const { data: course } = await admin
    .from("courses")
    .select("title, description, language")
    .eq("id", courseId)
    .single();
  if (!course) return new Response("Course not found", { status: 404 });

  // Verify access: admin sees all, moderator/creator must be assigned to this course
  if (profile.role !== "admin") {
    const accessErr = await assertCourseOwner(courseId, user.id);
    if (accessErr) return accessErr;
  }

  // Load learner progress summary
  const { data: enrollments } = await admin
    .from("enrollments")
    .select("id, progress, completed, user_id")
    .eq("course_id", courseId);

  const totalLearners = enrollments?.length ?? 0;
  const completed = enrollments?.filter((e) => e.completed).length ?? 0;
  const avgProgress = totalLearners > 0
    ? Math.round((enrollments ?? []).reduce((sum, e) => sum + (e.progress ?? 0), 0) / totalLearners)
    : 0;

  // Load lessons for context
  const { data: lessons } = await admin
    .from("lessons")
    .select("title, order")
    .eq("course_id", courseId)
    .order("order");

  const lessonList = (lessons ?? []).map((l) => `- Module ${l.order}: ${l.title}`).join("\n");

  const firstName = profile.full_name?.split(" ")[0]?.trim() ?? "";

  const systemPrompt = `You are an AI facilitation coach supporting ${firstName || "the facilitator"} — a course moderator or subject matter expert (SME) for "${course.title}".

COURSE OVERVIEW:
${course.description ? `Description: ${course.description}` : ""}
Modules:
${lessonList || "(no modules yet)"}

COHORT SNAPSHOT (live data):
- Total enrolled teacher-leaders: ${totalLearners}
- Completed the course: ${completed}
- Average progress: ${avgProgress}%

YOUR ROLE:
You are a facilitation support coach. You help the SME think through their work — grading, feedback, cohort support, calibration. You do NOT manage learners directly.

WHAT YOU CAN HELP WITH:
- Drafting or refining written feedback for learner submissions
- Thinking through how to apply the grading rubric (Approved / Needs Revision / Not Approved)
- Identifying patterns in cohort progress and suggesting facilitation strategies
- Calibrating grading standards — e.g., "Here's a borderline submission, how should I think about it?"
- Preparing for 1-on-1 or group check-ins with teacher-leaders
- General questions about adult learning, facilitation, and professional development coaching

BEHAVIOR:
- Be direct and practical — this is a professional tool, not a student-facing coach
- You CAN give concrete suggestions and recommendations (unlike the learner coach)
- When helping draft feedback, always ask what the SME wants to emphasize before writing
- Keep responses focused and concise
- If asked about a specific learner by name, note that you don't have individual learner details here — refer them to the Students tab

LANGUAGE: Reply in the same language the SME writes in.`;

  const encoder = new TextEncoder();
  const model = await getAIModel();

  if (model.startsWith("claude-")) {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const stream = anthropic.messages.stream({
      model,
      max_tokens: 1500,
      temperature: 0.4,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    });
    const readable = new ReadableStream({
      async start(controller) {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta" && event.delta.text) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      },
    });
    return new Response(readable, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  if (model.startsWith("gemini-")) {
    const gemini = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });
    const stream = await gemini.models.generateContentStream({
      model,
      contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      config: { systemInstruction: systemPrompt, maxOutputTokens: 1500, temperature: 0.4 },
    });
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.text ?? "";
          if (text) controller.enqueue(encoder.encode(text));
        }
        controller.close();
      },
    });
    return new Response(readable, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  // Default: OpenAI
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 15_000 });
  const stream = await openai.chat.completions.create({
    model,
    stream: true,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    max_tokens: 1500,
    temperature: 0.4,
  });
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? "";
        if (text) controller.enqueue(encoder.encode(text));
      }
      controller.close();
    },
  });
  return new Response(readable, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
