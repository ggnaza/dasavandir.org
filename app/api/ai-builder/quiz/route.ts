import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import OpenAI from "openai";

export const runtime = "nodejs";

function htmlToText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return new Response("Forbidden", { status: 403 });

  const { lessonId, count = 5 } = await req.json();
  if (!lessonId) return new Response("Missing lessonId", { status: 400 });

  const { data: lesson } = await admin
    .from("lessons")
    .select("title, content, video_url, slides_url")
    .eq("id", lessonId)
    .single();

  if (!lesson) return new Response("Lesson not found", { status: 404 });

  const parts: string[] = [];
  parts.push(`Lesson title: ${lesson.title}`);
  if (lesson.content) parts.push(`Lesson content:\n${htmlToText(lesson.content).slice(0, 4000)}`);
  if (lesson.video_url) parts.push(`This lesson also includes a video: ${lesson.video_url}`);
  if (lesson.slides_url) parts.push(`This lesson also includes a presentation: ${lesson.slides_url}`);

  if (parts.length === 1 && !lesson.content) {
    return new Response("Lesson has no content to generate questions from", { status: 400 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.7,
    messages: [
      {
        role: "system",
        content: `You are an expert educator creating multiple-choice quiz questions.
Generate exactly ${count} questions based on the lesson material provided.
Each question must have 4 answer options and exactly one correct answer.
Questions should test genuine understanding, not just memorization.
Return ONLY valid JSON — no markdown, no explanation.`,
      },
      {
        role: "user",
        content: `${parts.join("\n\n")}

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

The "correct" field is the 0-based index of the correct option.`,
      },
    ],
  });

  const raw = completion.choices[0].message.content ?? "";
  try {
    const json = JSON.parse(raw.replace(/```json|```/g, "").trim());
    return Response.json({ questions: json.questions });
  } catch {
    return new Response("AI returned invalid response. Please try again.", { status: 500 });
  }
}
