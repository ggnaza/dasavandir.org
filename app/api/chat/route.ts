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

  // Always resolve courseId — fall back to the lesson's own course_id
  const resolvedCourseId = effectiveCourseId ?? lesson?.course_id;

  // Verify the user is enrolled in this course (or is an admin/creator)
  let learnerFirstName = "";
  if (resolvedCourseId) {
    const [{ data: enrollment }, { data: profile }, { data: courseSettings }] = await Promise.all([
      admin.from("enrollments").select("id").eq("user_id", user.id).eq("course_id", resolvedCourseId).maybeSingle(),
      admin.from("profiles").select("role, full_name").eq("id", user.id).single(),
      admin.from("courses").select("ai_coach_enabled").eq("id", resolvedCourseId).single(),
    ]);
    const isStaff = ["admin", "course_creator", "course_manager"].includes(profile?.role ?? "");
    if (!enrollment && !isStaff) return new Response("Not enrolled in this course", { status: 403 });
    // Block if AI Coach is disabled for this course (admins/creators can still test it)
    if (courseSettings?.ai_coach_enabled === false && !isStaff) {
      return new Response("AI Coach is not enabled for this course", { status: 403 });
    }
    learnerFirstName = profile?.full_name?.split(" ")[0]?.trim() ?? "";
  } else {
    return new Response("Course not found", { status: 404 });
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

  const systemPrompt = `You are an AI learning coach for the course "${courseTitle}".
${courseDesc ? `Course description: ${courseDesc}` : ""}
${learnerFirstName ? `The learner's name is ${learnerFirstName}. Address them by first name naturally — use it in greetings, encouragement, and when asking follow-up questions. Don't overuse it; once or twice per conversation is enough.` : ""}
The learner is currently studying: "${lesson?.title ?? ""}".

════════════════════════════════════════
COURSE MATERIALS — your ONLY source of truth
════════════════════════════════════════
Current lesson:
${currentCombined || "(visual/video content — no text extracted)"}

Other lessons in this course:
${otherLessonsText || "(none yet)"}
${courseResourcesText ? `\nSupplementary resources:\n${courseResourcesText}` : ""}
${memoryContext ? `\nLearner memory from previous sessions:\n${memoryContext}` : ""}
════════════════════════════════════════

ANTI-HALLUCINATION RULES — non-negotiable:

1. **Stay in the materials.** Answer ONLY from the course content above. Do NOT invent facts, statistics, names, dates, quotes, studies, or examples that are not explicitly present in those materials.

2. **When the materials cover it** — answer directly from them. Do not add outside information, even if you know it.

3. **When the materials do NOT cover it** — you may use general knowledge, but you MUST prefix that part with:
   - English: "⚠️ This is not in the course materials:"
   - Armenian: "⚠️ Սա դասընթացի նյութերում չէ."
   If you are unsure whether something is in the materials, say so rather than guessing.

4. **Never fabricate.** If you don't know, say "I don't have information on that in the course materials" — do not make something up to sound helpful.

5. **External resources** — if you recommend a book, website, or video, ALWAYS add on its own line:
   - English: "* Not reviewed or endorsed by the Teach For Armenia team."
   - Armenian: "* Չի ստուգվել Դասավանդի՛ր Հայաստան թիմի կողմից."

LANGUAGE: Always reply in the same language the learner writes in. Armenian in → Armenian out. Never mix languages in one response.

BEHAVIOR:
- Be a thoughtful tutor, not a search engine
- Use **bold** for key terms, short bullet lists for steps or comparisons
- When quizzing: ask one question at a time, wait for the answer before continuing
- Give short focused answers (3–6 sentences) unless the learner asks for more detail
- Encourage effort, not just correct answers`;

  const encoder = new TextEncoder();
  let fullReply = "";

  if (model.startsWith("claude-")) {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const stream = anthropic.messages.stream({
      model,
      max_tokens: 1200,
      temperature: 0.3,
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
        maxOutputTokens: 1200,
        temperature: 0.3,
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
    max_tokens: 1200,
    temperature: 0.3,
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
