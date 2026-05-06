import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getAIModel, callLLM } from "@/lib/llm";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // Per-hour limit
  const { allowed } = await checkRateLimit(`capstone-submit:${user.id}`, 5, 60 * 60_000);
  if (!allowed) return rateLimitResponse({ limit: 5, windowSecs: 3600 });

  // Daily cap
  const { allowed: dailyOk } = await checkRateLimit(`capstone-daily:${user.id}`, 10, 24 * 60 * 60_000);
  if (!dailyOk) return rateLimitResponse({ limit: 10, windowSecs: 86400 });

  const { capstone_id, content, file_path, file_name, link_url } = await req.json();
  if (!content && !file_path && !link_url)
    return new Response("Submission is empty", { status: 400 });

  const admin = createAdminClient();
  const { data: capstone } = await admin
    .from("capstones")
    .select("title, instructions, rubric, course_id")
    .eq("id", capstone_id)
    .single();

  if (!capstone) return new Response("Capstone not found", { status: 404 });

  // Verify the student is enrolled in this course
  if (capstone.course_id) {
    const { data: enrollment } = await admin
      .from("enrollments")
      .select("id")
      .eq("user_id", user.id)
      .eq("course_id", capstone.course_id)
      .maybeSingle();
    if (!enrollment) return new Response("Not enrolled in this course", { status: 403 });
  }

  // Upsert — one submission per user per capstone
  const { data: submission, error: subError } = await admin
    .from("capstone_submissions")
    .upsert(
      { capstone_id, user_id: user.id, content, file_path, file_name, link_url, status: "submitted", submitted_at: new Date().toISOString() },
      { onConflict: "capstone_id,user_id" }
    )
    .select("id")
    .single();

  if (subError) {
    console.error("[capstone/save]", subError);
    return new Response("Failed to save submission", { status: 500 });
  }

  // Build rubric text safely
  let rubricText = "(no rubric)";
  try {
    rubricText = (Array.isArray(capstone.rubric) ? capstone.rubric : [])
      .map((r: any) => `- ${r.criterion} (max ${r.max_points} pts): ${r.description}`)
      .join("\n") || "(no rubric)";
  } catch { /* use default */ }

  // System message contains all instructions — user message contains only the submission
  // This prevents prompt injection from submission content
  const systemPrompt = `You are an expert evaluator. Evaluate the learner submission against the capstone rubric.

Assignment: ${capstone.title}
Instructions: ${capstone.instructions}

Rubric:
${rubricText}

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

Be fair and constructive.`;

  const submissionContext = [
    content ? `Written response:\n${content.slice(0, 3000)}` : null,
    file_name ? `Attached file: ${file_name} (evaluate based on written response and link if present)` : null,
    link_url ? `Submitted link: ${link_url}` : null,
  ].filter(Boolean).join("\n\n");

  try {
    const model = await getAIModel();
    const raw = await callLLM(model, systemPrompt, submissionContext, { maxTokens: 1500, jsonMode: true });
    let aiFeedback: any = {};
    try { aiFeedback = JSON.parse(raw.replace(/```json|```/g, "").trim()); } catch { /* keep empty object */ }

    await admin.from("capstone_submissions").update({
      ai_feedback: aiFeedback,
      ai_total_score: typeof aiFeedback.total_score === "number" ? aiFeedback.total_score : 0,
      status: "ai_reviewed",
    }).eq("id", submission.id);
  } catch (err) {
    console.error("[capstone/ai-eval]", err);
    await admin.from("capstone_submissions").update({ status: "submitted" }).eq("id", submission.id);
  }

  return Response.json({ submissionId: submission.id });
}
