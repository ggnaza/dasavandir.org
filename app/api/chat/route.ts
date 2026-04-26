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
  if (!allowed) return rateLimitResponse();

  const { messages, lessonId } = await req.json();

  // Load lesson context
  const admin = createAdminClient();
  const { data: lesson } = await admin
    .from("lessons")
    .select("title, content, courses(title, description)")
    .eq("id", lessonId)
    .single();

  const courseTitle = (lesson?.courses as any)?.title ?? "";
  const courseDesc = (lesson?.courses as any)?.description ?? "";

  // Strip HTML tags so AI receives clean text
  const plainContent = (lesson?.content ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 3000); // guard against very long lessons

  const systemPrompt = `You are an AI learning coach for an online course called "${courseTitle}".
${courseDesc ? `Course description: ${courseDesc}` : ""}

The learner is currently studying this lesson: "${lesson?.title ?? ""}".

Lesson content:
---
${plainContent || "(No content provided)"}
---

Your role:
- Answer questions about this lesson and course only
- Explain concepts clearly and simply
- Quiz the learner when they ask
- Summarize key points on request
- Encourage and guide without being condescending
- If asked about something outside this lesson/course, politely redirect to the lesson material
- Keep responses concise and focused`;

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
