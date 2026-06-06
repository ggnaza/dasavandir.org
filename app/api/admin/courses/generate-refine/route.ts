import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 90;

const EDITOR_ROLES = ["admin", "course_creator", "course_manager"];

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!EDITOR_ROLES.includes(profile?.role ?? "")) return new Response("Forbidden", { status: 403 });

  let currentCourse: any;
  let instruction: string;
  let language: string;

  try {
    const body = await req.json();
    currentCourse = body.currentCourse;
    instruction = body.instruction ?? "";
    language = body.language ?? "en";
  } catch {
    return new Response("Invalid request body.", { status: 400 });
  }

  if (!currentCourse || !instruction.trim()) {
    return new Response("Missing course or instruction.", { status: 400 });
  }

  const lang = language === "hy" ? "Armenian (Հայերեն)" : "English";

  const systemPrompt = `You are an expert instructional designer refining an existing course structure.
The user will give you a specific instruction about how to change the course.
Apply the instruction faithfully while preserving course quality and structure.
Do NOT hallucinate new facts — only reorganize, rewrite, add, or remove based on what is already present in the course.
All text must be in ${lang}.

Return ONLY valid JSON with the same structure as the input — no markdown, no extra text:
{
  "title": "...",
  "description": "...",
  "outcomes": ["..."],
  "lessons": [
    {
      "title": "...",
      "content": "<h2>...</h2><p>...</p>",
      "what_you_learn": "...",
      "slides_outline": "...",
      "video_script": "..."
    }
  ]
}`;

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Current course:\n${JSON.stringify(currentCourse, null, 2)}\n\nInstruction: ${instruction}`,
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 12000,
    temperature: 0.3,
  });

  const raw = completion.choices[0]?.message?.content ?? "";

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return new Response("AI returned unexpected output. Please try again.", { status: 500 });
  }

  if (!parsed.title || !Array.isArray(parsed.lessons)) {
    return new Response("AI returned an incomplete structure. Please try again.", { status: 500 });
  }

  return Response.json(parsed);
}
