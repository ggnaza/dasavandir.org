import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { assignment_id, content, file_path, file_name, link_url } = await req.json();

  if (!content && !file_path && !link_url) {
    return new Response("Submission is empty", { status: 400 });
  }

  const admin = createAdminClient();
  const { data: assignment } = await admin
    .from("assignments")
    .select("title, instructions, rubric")
    .eq("id", assignment_id)
    .single();

  if (!assignment) return new Response("Assignment not found", { status: 404 });

  // Save submission
  const { data: submission, error: subError } = await admin
    .from("submissions")
    .insert({ assignment_id, user_id: user.id, content, file_path, file_name, link_url, status: "submitted" })
    .select("id")
    .single();

  if (subError) return new Response(subError.message, { status: 500 });

  // Build context for AI evaluation
  const submissionContext = [
    content ? `Written response:\n${content.slice(0, 3000)}` : null,
    file_name ? `Attached file: ${file_name} (contents not available for automated review — evaluate based on written response and link if present)` : null,
    link_url ? `Submitted link: ${link_url}` : null,
  ].filter(Boolean).join("\n\n");

  const rubricText = assignment.rubric
    .map((r: any) => `- ${r.criterion} (max ${r.max_points} pts): ${r.description}`)
    .join("\n");

  const prompt = `You are an expert evaluator. Evaluate the learner submission against the rubric.

Assignment: ${assignment.title}
Instructions: ${assignment.instructions}

Rubric:
${rubricText}

Submission:
---
${submissionContext}
---

Return ONLY valid JSON:
{
  "feedback": [
    {
      "criterion": "exact criterion name",
      "score": <number>,
      "max_points": <number>,
      "feedback": "2-3 sentences of specific feedback"
    }
  ],
  "overall_comment": "2-3 sentence overall feedback",
  "total_score": <sum>,
  "total_possible": <sum of max_points>
}

If only a file or link was submitted without text, note that manual review may be needed for full evaluation. Be fair and constructive.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 1500,
    });

    const aiFeedback = JSON.parse(completion.choices[0].message.content ?? "{}");

    await admin.from("submissions").update({
      ai_feedback: aiFeedback,
      ai_total_score: aiFeedback.total_score ?? 0,
      status: "ai_reviewed",
    }).eq("id", submission.id);
  } catch {
    // Don't fail the submission if AI evaluation fails
    await admin.from("submissions").update({ status: "submitted" }).eq("id", submission.id);
  }

  return Response.json({ submissionId: submission.id });
}
