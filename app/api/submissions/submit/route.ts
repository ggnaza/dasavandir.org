import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { z } from "zod";
import { getAIModel, callLLM } from "@/lib/llm";

export const runtime = "nodejs";

const schema = z.object({
  assignment_id: z.string().uuid(),
  // Client sends explicit null for empty fields → accept null as well as undefined.
  content: z.string().max(10_000).nullish(),
  file_path: z.string().max(500).nullish(),
  file_name: z.string().max(255).nullish(),
  link_url: z.string().url().max(2000).nullish(),
  group_id: z.string().uuid().nullable().optional(),
});

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // Per-hour limit
  const { allowed } = await checkRateLimit(`submit:${user.id}`, 10, 60 * 60_000);
  if (!allowed) return rateLimitResponse({ limit: 10, windowSecs: 3600 });

  // Daily cap on AI evaluations
  const { allowed: dailyOk } = await checkRateLimit(`submit-daily:${user.id}`, 30, 24 * 60 * 60_000);
  if (!dailyOk) return rateLimitResponse({ limit: 30, windowSecs: 86400 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const { assignment_id, content, file_path, file_name, link_url, group_id } = parsed.data;

  if (!content && !file_path && !link_url) {
    return new Response("Submission is empty", { status: 400 });
  }

  const admin = createAdminClient();
  const { data: assignment } = await admin
    .from("assignments")
    .select("title, instructions, rubric, lesson_id, lessons(course_id)")
    .eq("id", assignment_id)
    .single();

  if (!assignment) return new Response("Assignment not found", { status: 404 });

  // Verify the student is enrolled in this course
  const courseId = (assignment.lessons as any)?.course_id;
  if (courseId) {
    const { data: enrollment } = await admin
      .from("enrollments")
      .select("id")
      .eq("user_id", user.id)
      .eq("course_id", courseId)
      .maybeSingle();
    if (!enrollment) return new Response("Not enrolled in this course", { status: 403 });
  }

  // Verify group membership if this is a group submission
  if (group_id) {
    const { data: membership } = await admin
      .from("course_group_members")
      .select("user_id")
      .eq("group_id", group_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return new Response("You are not a member of this group", { status: 403 });
  }

  // For group submissions, look up existing by group_id; for individual, by user_id
  const lookupField = group_id ? "group_id" : "user_id";
  const lookupValue = group_id ?? user.id;

  // Check for existing submission open for revision
  const { data: existing } = await admin
    .from("submissions")
    .select("id, status, user_id")
    .eq("assignment_id", assignment_id)
    .eq(lookupField, lookupValue)
    .in("status", ["needs_revision"])
    .maybeSingle();

  let submission: { id: string } | null = null;
  let subError: any = null;

  if (existing) {
    // Resubmission — update the row, update user_id to the new submitter
    const { data: updated, error: upErr } = await admin
      .from("submissions")
      .update({
        user_id: user.id, // track who last submitted
        content, file_path, file_name, link_url,
        status: "submitted",
        ai_feedback: null, ai_total_score: null,
        final_score: null, final_feedback: null, instructor_note: null,
        reviewed_at: null,
        submitted_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("id")
      .single();
    submission = updated;
    subError = upErr;
  } else {
    // Check for a final submission already (approved / not_approved)
    const { data: finalSub } = await admin
      .from("submissions")
      .select("id, status")
      .eq("assignment_id", assignment_id)
      .eq(lookupField, lookupValue)
      .in("status", ["approved", "not_approved"])
      .maybeSingle();
    if (finalSub) {
      return new Response(
        finalSub.status === "approved"
          ? "This assignment has already been approved."
          : "This assignment was not approved and cannot be resubmitted.",
        { status: 400 }
      );
    }

    // New submission
    const { data: inserted, error: insErr } = await admin
      .from("submissions")
      .insert({
        assignment_id,
        user_id: user.id,
        group_id: group_id ?? null,
        content, file_path, file_name, link_url,
        status: "submitted",
      })
      .select("id")
      .single();
    submission = inserted;
    subError = insErr;
  }

  if (subError || !submission) {
    console.error("[submission/save]", subError);
    return new Response("Failed to save submission", { status: 500 });
  }

  // Build rubric text safely
  let rubricText = "(no rubric)";
  try {
    rubricText = (Array.isArray(assignment.rubric) ? assignment.rubric : [])
      .map((r: any) => `- ${r.criterion} (max ${r.max_points} pts): ${r.description}`)
      .join("\n") || "(no rubric)";
  } catch { /* use default */ }

  // System message contains all instructions — user message contains only the submission
  // This prevents prompt injection from submission content
  const systemPrompt = `You are an expert evaluator. Evaluate the learner submission against the assignment rubric.

Assignment: ${assignment.title}
Instructions: ${assignment.instructions}

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

If only a file or link was submitted without text, note that manual review may be needed. Be fair and constructive.`;

  const submissionContext = [
    content ? `Written response:\n${content.slice(0, 3000)}` : null,
    file_name ? `Attached file: ${file_name} (contents not available — evaluate based on written response and link if present)` : null,
    link_url ? `Submitted link: ${link_url}` : null,
  ].filter(Boolean).join("\n\n");

  try {
    const model = await getAIModel();
    const raw = await callLLM(model, systemPrompt, submissionContext, { maxTokens: 1500, jsonMode: true });
    let aiFeedback: any = {};
    try { aiFeedback = JSON.parse(raw.replace(/```json|```/g, "").trim()); } catch { /* keep empty object */ }

    await admin.from("submissions").update({
      ai_feedback: aiFeedback,
      ai_total_score: typeof aiFeedback.total_score === "number" ? aiFeedback.total_score : 0,
      status: "ai_reviewed",
    }).eq("id", submission.id);
  } catch (err) {
    console.error("[submission/ai-eval]", err);
    await admin.from("submissions").update({ status: "submitted" }).eq("id", submission.id);
  }

  return Response.json({ submissionId: submission.id });
}
