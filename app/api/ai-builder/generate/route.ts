import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function extractText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());

  if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
    // @ts-ignore
    const pdfParse = require("pdf-parse");
    const data = await pdfParse(buffer);
    return data.text;
  }

  return buffer.toString("utf-8");
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return new Response("Forbidden", { status: 403 });

  let sourceText = "";

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const text = form.get("text") as string | null;
    if (file) sourceText = await extractText(file);
    else if (text) sourceText = text;
  } else {
    const body = await req.json();
    sourceText = body.text ?? "";
  }

  if (!sourceText.trim()) {
    return new Response("No content provided", { status: 400 });
  }

  // Truncate to ~12000 chars to stay within token limits
  const truncated = sourceText.slice(0, 12000);

  const prompt = `You are a course creation expert. Based on the source material below, create a structured online course.

Return ONLY valid JSON with this exact structure:
{
  "title": "Course title",
  "description": "2-3 sentence description of what learners will gain",
  "lessons": [
    {
      "title": "Lesson title",
      "content": "Full lesson content in HTML. Use <h2>, <p>, <ul><li>, <strong>, <em> tags. 300-600 words.",
      "quiz": {
        "questions": [
          {
            "question": "Question text?",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correct": 0
          }
        ]
      }
    }
  ]
}

Rules:
- Create 3-6 lessons based on content depth
- Each lesson covers one clear topic from the material
- Quiz: 3-4 questions per lesson, testing real understanding
- correct is the index (0-3) of the right option
- Content must be in valid HTML
- Stay strictly within the provided source material

Source material:
---
${truncated}
---`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    max_tokens: 4000,
  });

  const raw = completion.choices[0].message.content ?? "{}";

  try {
    const course = JSON.parse(raw);
    return Response.json(course);
  } catch {
    return new Response("Failed to parse AI response", { status: 500 });
  }
}
// cache bust
