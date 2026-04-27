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

  // Load current lesson + all lessons in the course
  const admin = createAdminClient();
  const { data: lesson } = await admin
    .from("lessons")
    .select("title, content, slides_url, slides_text, document_url, video_url, course_id, courses(title, description)")
    .eq("id", lessonId)
    .single();

  const courseTitle = (lesson?.courses as any)?.title ?? "";
  const courseDesc = (lesson?.courses as any)?.description ?? "";

  // Load all other lessons in the course for full context
  const { data: allLessons } = await admin
    .from("lessons")
    .select("title, content, slides_text")
    .eq("course_id", lesson?.course_id)
    .neq("id", lessonId)
    .order("order");

  function lessonToText(l: { title: string; content: string | null; slides_text: string | null }) {
    const text = (l.content ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const slides = (l.slides_text ?? "").trim();
    const combined = [text, slides].filter(Boolean).join("\n").slice(0, 1500);
    return combined ? `### ${l.title}\n${combined}` : `### ${l.title}\n(visual/video content)`;
  }

  const currentText = (lesson?.content ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const currentSlides = (lesson as any)?.slides_text ?? "";
  const currentCombined = [currentText, currentSlides].filter(Boolean).join("\n").slice(0, 4000);

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

Your role:
- Help the learner using the course materials above and your general knowledge of the subject
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
