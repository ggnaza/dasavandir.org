import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return new Response("Forbidden", { status: 403 });

  const { lessonTitle, lessonContent } = await req.json();

  const systemPrompt = `You are an instructional designer. Given a lesson title and content, generate a practical assignment for learners.

Return a JSON object with exactly this shape:
{
  "title": "Short assignment title",
  "instructions": "HTML string with rich formatting — use <h2>, <p>, <ul>/<li>, <table> etc. Be specific and actionable.",
  "rubric": [
    { "criterion": "Criterion name", "description": "What full marks looks like", "max_points": 20 }
  ]
}

Rules:
- Instructions should be 150-300 words, formatted with headings and bullet points
- Use a <table> in the instructions when comparing/evaluating multiple items makes sense
- Rubric should have 3-5 criteria, total points between 50-100
- Be specific to the lesson content provided`;

  const contentText = lessonContent
    ? lessonContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 3000)
    : "";

  const userPrompt = `Lesson title: ${lessonTitle}\n\nLesson content:\n${contentText || "(no content provided)"}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const raw = completion.choices[0].message.content ?? "{}";
  let result: { title?: string; instructions?: string; rubric?: unknown[] };
  try {
    result = JSON.parse(raw);
  } catch {
    return new Response("AI returned invalid JSON", { status: 500 });
  }

  return Response.json(result);
}
