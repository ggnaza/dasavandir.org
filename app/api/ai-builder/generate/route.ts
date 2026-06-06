import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getAIModel, callLLM } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 120;

async function extractText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());

  if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
    const pdfParse = require("pdf-parse/lib/pdf-parse.js");
    const data = await pdfParse(buffer);
    return data.text ?? "";
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

  // 5 generations per hour per admin
  const { allowed } = await checkRateLimit(`ai-builder:${user.id}`, 5, 60 * 60_000);
  if (!allowed) return rateLimitResponse({ limit: 5, windowSecs: 3600 });

  let sourceText = "";

  const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const text = form.get("text") as string | null;
    if (file) {
      if (file.size > MAX_FILE_BYTES) {
        return new Response("File too large (max 10 MB)", { status: 413 });
      }
      sourceText = await extractText(file);
    } else if (text) sourceText = text;
  } else {
    const body = await req.json();
    sourceText = body.text ?? "";
  }

  if (!sourceText.trim()) {
    return new Response("No content provided", { status: 400 });
  }

  // Truncate to ~12000 chars to stay within token limits
  const truncated = sourceText.slice(0, 12000);

  const systemPrompt = `You are a course creation expert.

ANTI-HALLUCINATION RULES — strictly enforced:
1. Base ALL lesson content and quiz questions EXCLUSIVELY on the provided source material.
2. Do NOT invent facts, statistics, names, quotes, examples, or case studies not present in the material.
3. Do NOT add general knowledge that happens to relate to the topic — only use what's in the source.
4. If the source is short, create fewer/shorter lessons rather than padding with invented content.
5. Return ONLY valid JSON — no markdown fences, no explanation.`;

  const prompt = `Create a structured online course from the source material below.

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

- Create 3-6 lessons based on content depth
- Each lesson covers one clear topic from the material
- Quiz: 3-4 questions per lesson, each grounded in the lesson content
- "correct" is the 0-based index of the correct option
- Content must be valid HTML

Source material (your ONLY source of truth):
---
${truncated}
---`;

  const model = await getAIModel();
  const raw = await callLLM(model, systemPrompt, prompt, { maxTokens: 4000, temperature: 0.3, jsonMode: true });

  try {
    const course = JSON.parse(raw);
    return Response.json(course);
  } catch {
    return new Response("Failed to parse AI response", { status: 500 });
  }
}
// cache bust
