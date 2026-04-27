import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import OpenAI from "openai";

export async function POST(req: Request) {
  // Verify user is authenticated
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // 20 messages per minute per user
  const { allowed } = await checkRateLimit(`chat:${user.id}`, 20, 60_000);
  if (!allowed) return rateLimitResponse({ limit: 20, windowSecs: 60 });

  const { messages, lessonId } = await req.json();

  // Load lesson context
  const admin = createAdminClient();
  const { data: lesson } = await admin
    .from("lessons")
    .select("title, content, slides_url, document_url, video_url, courses(title, description)")
    .eq("id", lessonId)
    .single();

  const courseTitle = (lesson?.courses as any)?.title ?? "";
  const courseDesc = (lesson?.courses as any)?.description ?? "";

  // Strip HTML tags so AI receives clean text
  const plainContent = (lesson?.content ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 3000);

  const hasSlides = !!(lesson as any)?.slides_url;
  const hasDoc = !!(lesson as any)?.document_url;
  const hasVideo = !!(lesson as any)?.video_url;

  const mediaNote = [
    hasSlides && "Google Slides presentation",
    hasDoc && "document",
    hasVideo && "video",
  ].filter(Boolean).join(", ");

  const systemPrompt = `You are an AI learning coach for an online course called "${courseTitle}".
${courseDesc ? `Course description: ${courseDesc}` : ""}

The learner is currently studying this lesson: "${lesson?.title ?? ""}".
${mediaNote ? `This lesson includes: ${mediaNote}. You cannot see these directly, but use your knowledge of the topic to help.` : ""}

Lesson text content:
---
${plainContent || "(This lesson uses visual materials like slides or video — no plain text available)"}
---

Your role:
- Help the learner understand the lesson topic using the content above and your general knowledge of the subject
- Even if lesson text is empty, answer questions related to the lesson title and course topic
- Explain concepts clearly and simply
- Quiz the learner when they ask
- Summarize key points on request
- Encourage and guide without being condescending
- Keep responses concise and focused
- Always respond in the same language the learner writes in (Armenian, English, or any other language)`;

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 15_000 });
  const stream = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    stream: true,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
    max_tokens: 600,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? "";
        if (text) controller.enqueue(encoder.encode(text));
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
