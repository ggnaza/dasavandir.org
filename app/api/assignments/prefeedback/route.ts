import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import OpenAI from "openai";
import pdfParse from "pdf-parse";

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { allowed } = await checkRateLimit(`prefeedback:${user.id}`, 5, 60_000);
  if (!allowed) return rateLimitResponse({ limit: 5, windowSecs: 60 });

  // Accept both JSON and FormData (when file is attached)
  let assignment_id: string;
  let draft = "";
  let pdfText = "";

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    assignment_id = form.get("assignment_id") as string;
    draft = (form.get("draft") as string) ?? "";
    const file = form.get("file") as File | null;
    if (file && file.type === "application/pdf") {
      const buffer = Buffer.from(await file.arrayBuffer());
      const parsed = await pdfParse(buffer).catch(() => null);
      pdfText = parsed?.text?.trim().slice(0, 4000) ?? "";
    }
  } else {
    const body = await req.json();
    assignment_id = body.assignment_id;
    draft = body.draft ?? "";
  }

  if (!assignment_id) return new Response("Missing fields", { status: 400 });
  if (!draft.trim() && !pdfText) return new Response("Please provide a written response or upload a PDF.", { status: 400 });

  const admin = createAdminClient();

  // Load assignment + verify pre_submission_ai is enabled on the course
  const { data: assignment } = await admin
    .from("assignments")
    .select("title, instructions, rubric, lessons(course_id)")
    .eq("id", assignment_id)
    .single();

  if (!assignment) return new Response("Not found", { status: 404 });

  const courseId = (assignment.lessons as any)?.course_id;
  if (courseId) {
    const { data: course } = await admin
      .from("courses")
      .select("pre_submission_ai")
      .eq("id", courseId)
      .single();
    if (!course?.pre_submission_ai) {
      return new Response("Pre-submission feedback is not enabled for this course", { status: 403 });
    }
  }

  const rubricText = Array.isArray(assignment.rubric)
    ? assignment.rubric.map((r: any) => `- ${r.criterion} (${r.max_points} pts)`).join("\n")
    : "";

  const draftSection = [
    draft.trim() ? `Written response:\n${draft.slice(0, 3000)}` : "",
    pdfText ? `Uploaded PDF content:\n${pdfText}` : "",
  ].filter(Boolean).join("\n\n");

  const prompt = `You are a helpful writing coach reviewing a student's draft assignment before official submission.

Assignment: ${assignment.title}
Instructions: ${assignment.instructions ?? ""}

Rubric:
${rubricText || "(no rubric provided)"}

Student's draft:
---
${draftSection}
---

Give constructive improvement suggestions BEFORE the student submits. Do NOT grade or score. Focus on:
1. What is already strong
2. What is missing or weak (based on rubric)
3. Specific ways to improve before submitting

Be encouraging and specific. Use the same language as the draft (Armenian or English). Keep it under 400 words.`;

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 20_000 });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 600,
  });

  const feedback = completion.choices[0]?.message?.content ?? "";
  return Response.json({ feedback });
}
