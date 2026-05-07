import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getAIModel } from "@/lib/llm";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

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

  const model = await getAIModel();

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

  // Load course-level supplementary resources for AI context
  let courseResourcesText = "";
  if (effectiveCourseId) {
    const { data: resources } = await admin
      .from("course_resources")
      .select("title, url, file_name, extracted_text")
      .eq("course_id", effectiveCourseId)
      .order("created_at");
    if (resources?.length) {
      courseResourcesText = resources
        .map((r) => {
          const ref = r.url ? `(${r.url})` : r.file_name ? `(${r.file_name})` : "";
          const body = r.extracted_text?.trim() ?? "";
          return body
            ? `### ${r.title} ${ref}\n${body.slice(0, 3000)}`
            : `### ${r.title} ${ref}\n(no text extracted)`;
        })
        .join("\n\n")
        .slice(0, 8000);
    }
  }

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
    const combined = [text, slides, doc].filter(Boolean).join("\n").slice(0, 3000);
    return combined ? `### ${l.title}\n${combined}` : `### ${l.title}\n(visual/video content)`;
  }

  const currentText = (lesson?.content ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const currentSlides = (lesson as any)?.slides_text ?? "";
  const currentDoc = (lesson as any)?.document_text ?? "";
  const currentCombined = [currentText, currentSlides, currentDoc].filter(Boolean).join("\n").slice(0, 12000);

  const otherLessonsText = (allLessons ?? []).map(lessonToText).join("\n\n").slice(0, 8000);

  const systemPrompt = `You are an AI learning coach for an online course called "${courseTitle}".
${courseDesc ? `Course description: ${courseDesc}` : ""}

The learner is currently studying: "${lesson?.title ?? ""}".

=== COURSE MATERIALS (your primary source of truth) ===

Current lesson content:
---
${currentCombined || "(visual/video content — no text available)"}
---

Other lessons in this course:
---
${otherLessonsText || "(no other lessons yet)"}
---
${courseResourcesText ? `\nSupplementary resources added by the course creator:\n---\n${courseResourcesText}\n---` : ""}
${memoryContext ? `\nWhat you remember about this learner from previous sessions:\n---\n${memoryContext}\n---` : ""}

=== YOUR RULES ===

PRIORITY ORDER — follow strictly:
1. Answer using ONLY the course materials above whenever possible.
2. If the materials clearly cover the topic, do not add outside information unless the learner asks.
3. If the materials do NOT cover the topic, you may use your general knowledge — but you MUST clearly label it:
   - In English: start that part with "This is not from the course materials:"
   - In Armenian: start with "Սա դասընթացի նյութերից չէ."
4. When suggesting external resources (books, videos, websites), ALWAYS end with this disclaimer on its own line:
   - In English: "* These resources are not reviewed or confirmed by the Teach For Armenia team."
   - In Armenian: "* Այս նյութերը չեն ստուգվել կամ հաստատվել Դասավանդի՛ր Հայաստան թիմի կողմից։"

LANGUAGE: Always respond in the exact same language the learner writes in. If they write in Armenian, respond fully in Armenian. Never switch languages mid-response.

BEHAVIOR:
- Explain concepts clearly and simply
- Quiz the learner when they ask
- Summarize key points on request
- Encourage without being condescending
- Keep responses concise and focused`;

  const encoder = new TextEncoder();
  let fullReply = "";

  if (model.startsWith("claude-")) {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const stream = anthropic.messages.stream({
      model,
      max_tokens: 1000,
      system: systemPrompt,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    const readable = new ReadableStream({
      async start(controller) {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            const text = event.delta.text;
            if (text) {
              fullReply += text;
              controller.enqueue(encoder.encode(text));
            }
          }
        }
        controller.close();
        if (effectiveCourseId && fullReply) {
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          updateMemory(admin, userId, effectiveCourseId, messages, fullReply, memoryContext, openai).catch(() => {});
        }
      },
    });

    return new Response(readable, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  if (model.startsWith("gemini-")) {
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
    max_tokens: 1000,
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
