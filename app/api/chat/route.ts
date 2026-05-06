import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

const GEMINI_MODELS = [
  "gemini-2.0-flash",
  "gemini-2.5-flash-preview-04-17",
  "gemini-2.5-pro-preview-05-06",
] as const;

const chatSchema = z.object({
  lessonId: z.string().uuid(),
  courseId: z.string().uuid().optional(),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(10_000),
  })).max(100),
});

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // Per-minute burst limit
  const { allowed } = await checkRateLimit(`chat:${user.id}`, 20, 60_000);
  if (!allowed) return rateLimitResponse({ limit: 20, windowSecs: 60 });

  // Daily cap — prevents runaway AI costs
  const { allowed: dailyOk } = await checkRateLimit(`chat-daily:${user.id}`, 200, 24 * 60 * 60_000);
  if (!dailyOk) return rateLimitResponse({ limit: 200, windowSecs: 86400 });

  const parsed = chatSchema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });
  const { messages, lessonId, courseId } = parsed.data;
  const userId = user.id;

  const admin = createAdminClient();

  // Load model from admin settings
  const { data: settingRow } = await admin
    .from("settings")
    .select("value")
    .eq("key", "ai_coach_model")
    .maybeSingle();
  const model: string = settingRow?.value ?? "gpt-4o-mini";

  // Load lesson + course context
  const { data: lesson } = await admin
    .from("lessons")
    .select("title, content, slides_text, document_text, video_url, course_id, courses(title, description)")
    .eq("id", lessonId)
    .single();

  const courseTitle = (lesson?.courses as any)?.title ?? "";
  const courseDesc = (lesson?.courses as any)?.description ?? "";
  const effectiveCourseId = courseId ?? lesson?.course_id;

  // Verify the user is enrolled in this course (or is an admin/creator)
  if (effectiveCourseId) {
    const [{ data: enrollment }, { data: profile }] = await Promise.all([
      admin.from("enrollments").select("id").eq("user_id", user.id).eq("course_id", effectiveCourseId).maybeSingle(),
      admin.from("profiles").select("role").eq("id", user.id).single(),
    ]);
    const isStaff = ["admin", "course_creator", "course_manager"].includes(profile?.role ?? "");
    if (!enrollment && !isStaff) return new Response("Not enrolled in this course", { status: 403 });
  }

  // Load all other lessons for context
  const { data: allLessons } = await admin
    .from("lessons")
    .select("title, content, slides_text, document_text")
    .eq("course_id", lesson?.course_id)
    .neq("id", lessonId)
    .order("order");

  // Load AI memory for this user+course
  let memoryContext = "";
  if (effectiveCourseId && userId) {
    const { data: memory } = await admin
      .from("ai_coach_memory")
      .select("summary")
      .eq("user_id", userId)
      .eq("course_id", effectiveCourseId)
      .single();
    if (memory?.summary) {
      memoryContext = memory.summary;
    }
  }

  function lessonToText(l: { title: string; content: string | null; slides_text: string | null; document_text: string | null }) {
    const text = (l.content ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const slides = (l.slides_text ?? "").trim();
    const doc = (l.document_text ?? "").trim();
    const combined = [text, slides, doc].filter(Boolean).join("\n").slice(0, 1500);
    return combined ? `### ${l.title}\n${combined}` : `### ${l.title}\n(visual/video content)`;
  }

  const currentText = (lesson?.content ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const currentSlides = (lesson as any)?.slides_text ?? "";
  const currentDoc = (lesson as any)?.document_text ?? "";
  const currentCombined = [currentText, currentSlides, currentDoc].filter(Boolean).join("\n").slice(0, 4000);

  const otherLessonsText = (allLessons ?? []).map(lessonToText).join("\n\n").slice(0, 4000);

  const systemPrompt = `You are an AI learning coach for an online course called "${courseTitle}".
${courseDesc ? `Course description: ${courseDesc}` : ""}

The learner is currently studying: "${lesson?.title ?? ""}".

Current lesson content:
---
${currentCombined || "(visual/video content — use your knowledge of the topic)"}
---

Other lessons in this course (for broader context):
---
${otherLessonsText || "(no other lessons yet)"}
---
${memoryContext ? `\nWhat you know about this learner from previous sessions:\n---\n${memoryContext}\n---` : ""}

Your role:
- Help the learner using the course materials above and your general knowledge of the subject
- Explain concepts clearly and simply
- Quiz the learner when they ask
- Summarize key points on request
- Encourage and guide without being condescending
- Keep responses concise and focused
- Always respond in the same language the learner writes in (Armenian, English, or any other language)
- When relevant, suggest additional ways to learn: YouTube searches, book titles, key terms to Google, or well-known free resources
- Always add a disclaimer after any external suggestion. In English: "* These resources are not reviewed or confirmed by the Teach For Armenia team." In Armenian: "* Այս նյութերը չեն ստուգվել կամ հաստատվել Դասավանդի՛ր Հայաստան թիմի կողմից։"`;

  const encoder = new TextEncoder();
  let fullReply = "";

  if ((GEMINI_MODELS as readonly string[]).includes(model)) {
    const gemini = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });

    const geminiMessages = messages.map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const stream = await gemini.models.generateContentStream({
      model,
      contents: geminiMessages,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: 600,
      },
    });

    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.text ?? "";
          if (text) {
            fullReply += text;
            controller.enqueue(encoder.encode(text));
          }
        }
        controller.close();

        if (effectiveCourseId && fullReply) {
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          updateMemory(admin, userId, effectiveCourseId, messages, fullReply, memoryContext, openai).catch(() => {});
        }
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // Default: OpenAI
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 15_000 });

  const stream = await openai.chat.completions.create({
    model,
    stream: true,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
    max_tokens: 600,
  });

  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? "";
        if (text) {
          fullReply += text;
          controller.enqueue(encoder.encode(text));
        }
      }
      controller.close();

      if (effectiveCourseId && fullReply) {
        updateMemory(admin, userId, effectiveCourseId, messages, fullReply, memoryContext, openai).catch(() => {});
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

async function updateMemory(
  admin: any,
  userId: string,
  courseId: string,
  messages: any[],
  latestReply: string,
  existingMemory: string,
  openai: OpenAI
) {
  // Only update every 4 messages to avoid too many calls
  if (messages.length % 4 !== 0) return;

  const recentExchange = messages.slice(-4).map((m: any) => `${m.role}: ${m.content}`).join("\n");
  const prompt = `You are summarizing what a learner has discussed with an AI tutor.

${existingMemory ? `Existing memory:\n${existingMemory}\n\n` : ""}Recent conversation:
${recentExchange}
AI: ${latestReply}

Update the memory summary (max 300 words). Include:
- Topics they struggled with or found confusing
- Concepts they already understand well
- Questions they asked
- Their learning style or language preference

Be concise. Write as bullet points. This summary will be shown to the AI tutor in future sessions.`;

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 400,
    });
    const newMemory = res.choices[0]?.message?.content ?? "";
    if (newMemory) {
      await admin.from("ai_coach_memory").upsert(
        { user_id: userId, course_id: courseId, summary: newMemory, updated_at: new Date().toISOString() },
        { onConflict: "user_id,course_id" }
      );
    }
  } catch { /* silent fail */ }
}
