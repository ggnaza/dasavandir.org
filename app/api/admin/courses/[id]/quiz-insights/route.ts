import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { getAIModel, callLLM } from "@/lib/llm";
import { z } from "zod";

export const runtime = "nodejs";

const weakQuizSchema = z.object({
  lessonOrder: z.number(),
  lessonTitle: z.string(),
  completionPct: z.number(),
  cohortAvgScore: z.number().nullable(),
  weakQuestions: z.array(z.object({
    questionText: z.string(),
    successPct: z.number().nullable(),
    topWrongAnswer: z.string().nullable(),
    topWrongCount: z.number(),
  })),
});

const schema = z.object({
  courseTitle: z.string(),
  cohortSize: z.number(),
  isCohortLimited: z.boolean(),
  weakQuizzes: z.array(weakQuizSchema),
  allQuizzes: z.array(z.object({
    lessonOrder: z.number(),
    lessonTitle: z.string(),
    completionPct: z.number(),
    cohortAvgScore: z.number().nullable(),
  })),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!profile) return new Response("Unauthorized", { status: 401 });

  const ALLOWED_ROLES = ["admin", "course_creator", "course_manager"];
  if (!ALLOWED_ROLES.includes(profile.role)) return new Response("Forbidden", { status: 403 });

  const ownerErr = await assertCourseOwner(params.id, user.id);
  if (ownerErr) return ownerErr;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const { courseTitle, cohortSize, isCohortLimited, weakQuizzes, allQuizzes } = parsed.data;

  // Build structured context for the AI
  const completionSummary = allQuizzes
    .map((q) => `  - Module ${q.lessonOrder} "${q.lessonTitle}": ${q.completionPct}% completion${q.cohortAvgScore !== null ? `, avg score ${q.cohortAvgScore}%` : ", no scores yet"}`)
    .join("\n");

  const weakDetail = weakQuizzes.length === 0
    ? "No quizzes scored below 50% cohort average — overall performance is satisfactory."
    : weakQuizzes.map((q) => {
        const qLines = q.weakQuestions.map((wq) => {
          const wrongPart = wq.topWrongAnswer
            ? `, most common wrong answer: "${wq.topWrongAnswer}" (chosen ${wq.topWrongCount} times)`
            : "";
          return `    • "${wq.questionText}" — ${wq.successPct ?? "?"}% success rate${wrongPart}`;
        }).join("\n");
        return `  Module ${q.lessonOrder} "${q.lessonTitle}" (avg ${q.cohortAvgScore}%):\n${qLines || "    (no specific weak questions identified)"}`;
      }).join("\n\n");

  const systemPrompt = `You are an expert learning designer and educational data analyst.
Analyze quiz performance data from a cohort of educators and identify knowledge gaps and learning patterns.
Your analysis should be practical, specific, and actionable for facilitators.
Write in clear paragraphs. Avoid bullet lists unless listing specific recommendations.
Keep the total response under 400 words.`;

  const userMessage = `Course: "${courseTitle}"
Cohort: ${cohortSize} learner${cohortSize !== 1 ? "s" : ""}${isCohortLimited ? " (filtered cohort)" : ""}

Quiz completion and score overview:
${completionSummary}

Weak areas (quizzes/questions where cohort scored below threshold):
${weakDetail}

Please provide:
1. A brief overall assessment of knowledge gaps (2-3 sentences)
2. The 2-3 most significant conceptual gaps you can identify from the wrong-answer patterns
3. Specific recommendations for what facilitators should revisit or reinforce in their next session`;

  try {
    const model = await getAIModel();
    const insight = await callLLM(model, systemPrompt, userMessage, { maxTokens: 600 });
    return Response.json({ insight });
  } catch (err) {
    console.error("[quiz-insights]", err);
    return new Response("Failed to generate insights", { status: 500 });
  }
}
