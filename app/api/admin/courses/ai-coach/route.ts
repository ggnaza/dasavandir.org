import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getAIModel, GEMINI_API_KEY } from "@/lib/llm";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { getModeratorCohort } from "@/lib/get-moderator-cohort";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const schema = z.object({
  courseId: z.string().uuid(),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(10_000),
  })).max(100),
});

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (!profile) return new Response("Unauthorized", { status: 401 });
  if (!["admin", "course_creator", "course_manager"].includes(profile.role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const { allowed } = await checkRateLimit(`creator-coach:${user.id}`, 30, 60 * 60_000);
  if (!allowed) return rateLimitResponse({ limit: 30, windowSecs: 3600 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });
  const { courseId, messages } = parsed.data;

  // Load course info
  const { data: course } = await admin
    .from("courses")
    .select("title, description, language")
    .eq("id", courseId)
    .single();
  if (!course) return new Response("Course not found", { status: 404 });

  // Verify access: admin sees all, moderator/creator must be assigned to this course
  if (profile.role !== "admin") {
    const accessErr = await assertCourseOwner(courseId, user.id);
    if (accessErr) return accessErr;
  }

  // Cohort filter for course_managers
  const cohortIds = await getModeratorCohort(user.id, courseId, profile.role);

  // Load lessons
  const { data: lessons } = await admin
    .from("lessons")
    .select("id, title, order")
    .eq("course_id", courseId)
    .order("order");

  const lessonIds = (lessons ?? []).map((l) => l.id);

  // Load all enrollments, then filter to cohort if applicable
  const { data: allEnrollments } = await admin
    .from("enrollments")
    .select("user_id")
    .eq("course_id", courseId);

  const enrollments = cohortIds !== null
    ? (allEnrollments ?? []).filter((e) => cohortIds.includes(e.user_id))
    : (allEnrollments ?? []);

  const userIds = enrollments.map((e) => e.user_id);
  const totalLearners = userIds.length;

  // Parallel fetch: profiles, progress, quiz scores, submissions
  const [
    { data: learnerProfiles },
    { data: progressRows },
    { data: quizzes },
    { data: assignments },
  ] = await Promise.all([
    userIds.length > 0
      ? admin.from("profiles").select("id, full_name, email").in("id", userIds)
      : Promise.resolve({ data: [] }),
    userIds.length > 0 && lessonIds.length > 0
      ? admin.from("progress").select("user_id, lesson_id").in("user_id", userIds).in("lesson_id", lessonIds)
      : Promise.resolve({ data: [] }),
    lessonIds.length > 0
      ? admin.from("quizzes").select("id, lesson_id").in("lesson_id", lessonIds)
      : Promise.resolve({ data: [] }),
    lessonIds.length > 0
      ? admin.from("assignments").select("id, lesson_id, title, max_score").in("lesson_id", lessonIds)
      : Promise.resolve({ data: [] }),
  ]);

  const quizIds = (quizzes ?? []).map((q: { id: string }) => q.id);
  const assignmentIds = (assignments ?? []).map((a: { id: string }) => a.id);

  const [{ data: quizResponses }, { data: submissions }] = await Promise.all([
    quizIds.length > 0 && userIds.length > 0
      ? admin.from("quiz_responses").select("quiz_id, user_id, score").in("quiz_id", quizIds).in("user_id", userIds).order("submitted_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    assignmentIds.length > 0 && userIds.length > 0
      ? admin.from("submissions").select("assignment_id, user_id, status, final_score, ai_total_score").in("assignment_id", assignmentIds).in("user_id", userIds)
      : Promise.resolve({ data: [] }),
  ]);

  // Build per-learner snapshot
  const quizIdToLessonId = Object.fromEntries((quizzes ?? []).map((q: { id: string; lesson_id: string }) => [q.id, q.lesson_id]));
  const assignmentById = Object.fromEntries((assignments ?? []).map((a: { id: string; lesson_id: string; title: string; max_score: number }) => [a.id, a]));

  const progressByUser: Record<string, Set<string>> = {};
  for (const p of progressRows ?? []) {
    if (!progressByUser[p.user_id]) progressByUser[p.user_id] = new Set();
    progressByUser[p.user_id].add(p.lesson_id);
  }

  const quizScoreByUserLesson: Record<string, Record<string, number>> = {};
  for (const r of quizResponses ?? []) {
    const lid = quizIdToLessonId[r.quiz_id];
    if (!lid) continue;
    if (!quizScoreByUserLesson[r.user_id]) quizScoreByUserLesson[r.user_id] = {};
    if (quizScoreByUserLesson[r.user_id][lid] === undefined) {
      quizScoreByUserLesson[r.user_id][lid] = r.score ?? 0;
    }
  }

  const submissionByUserAssignment: Record<string, Record<string, { status: string; score: number | null }>> = {};
  for (const s of submissions ?? []) {
    if (!submissionByUserAssignment[s.user_id]) submissionByUserAssignment[s.user_id] = {};
    submissionByUserAssignment[s.user_id][s.assignment_id] = {
      status: s.status,
      score: s.final_score ?? s.ai_total_score ?? null,
    };
  }

  const profileById = Object.fromEntries((learnerProfiles ?? []).map((p) => [p.id, p]));

  const totalLessons = lessonIds.length;
  const learnerRows = userIds.map((uid) => {
    const p = profileById[uid];
    const name = p?.full_name || p?.email || uid.slice(0, 8);
    const completedCount = progressByUser[uid]?.size ?? 0;
    const pct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

    const quizScores = Object.values(quizScoreByUserLesson[uid] ?? {});
    const avgQuiz = quizScores.length > 0
      ? Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length)
      : null;

    const subs = submissionByUserAssignment[uid] ?? {};
    const assignmentStatuses = assignmentIds.map((aid) => {
      const sub = subs[aid];
      if (!sub) return "not submitted";
      const scoreStr = sub.score !== null ? ` (${sub.score}/${assignmentById[aid]?.max_score ?? "?"})` : "";
      return `${sub.status}${scoreStr}`;
    });

    const assignStr = assignmentIds.length > 0
      ? ` | assignments: ${assignmentStatuses.join(", ")}`
      : "";
    const quizStr = avgQuiz !== null ? ` | avg quiz: ${avgQuiz}%` : "";

    return `  • ${name}: ${pct}% progress (${completedCount}/${totalLessons} lessons)${quizStr}${assignStr}`;
  });

  const cohortCompleted = userIds.filter((uid) => (progressByUser[uid]?.size ?? 0) === totalLessons && totalLessons > 0).length;
  const avgProgress = totalLearners > 0
    ? Math.round(userIds.reduce((sum, uid) => {
        const c = progressByUser[uid]?.size ?? 0;
        return sum + (totalLessons > 0 ? (c / totalLessons) * 100 : 0);
      }, 0) / totalLearners)
    : 0;

  const lessonList = (lessons ?? []).map((l) => `- Module ${l.order}: ${l.title}`).join("\n");
  const cohortLabel = cohortIds !== null ? "your cohort" : "all enrolled learners";
  const firstName = profile.full_name?.split(" ")[0]?.trim() ?? "";

  const systemPrompt = `You are an AI facilitation coach supporting ${firstName || "the facilitator"} — a course moderator or subject matter expert (SME) for "${course.title}".

COURSE OVERVIEW:
${course.description ? `Description: ${course.description}` : ""}
Modules:
${lessonList || "(no modules yet)"}

COHORT SNAPSHOT — ${cohortLabel} (live data):
- Total teacher-leaders: ${totalLearners}
- Completed all lessons: ${cohortCompleted}
- Average progress: ${avgProgress}%

PER-LEARNER BREAKDOWN:
${learnerRows.join("\n") || "  (no learners enrolled)"}

YOUR ROLE:
You are a facilitation support coach. You help the SME think through their work — grading, feedback, cohort support, calibration.

WHAT YOU CAN HELP WITH:
- Drafting or refining written feedback for learner submissions
- Thinking through how to apply the grading rubric (Approved / Needs Revision / Not Approved)
- Identifying patterns in cohort progress and suggesting facilitation strategies
- Calibrating grading standards — e.g., "Here's a borderline submission, how should I think about it?"
- Flagging learners who may need outreach based on progress data above
- Preparing for 1-on-1 or group check-ins with teacher-leaders
- General questions about adult learning, facilitation, and professional development coaching

BEHAVIOR:
- Be direct and practical — this is a professional tool, not a student-facing coach
- You CAN give concrete suggestions and recommendations (unlike the learner coach)
- When helping draft feedback, always ask what the SME wants to emphasize before writing
- Reference learner names and specific data from the breakdown above when relevant
- Keep responses focused and concise

LANGUAGE: Reply in the same language the SME writes in.`;

  const encoder = new TextEncoder();
  const model = await getAIModel();

  if (model.startsWith("claude-")) {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const stream = anthropic.messages.stream({
      model,
      max_tokens: 1500,
      temperature: 0.4,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    });
    const readable = new ReadableStream({
      async start(controller) {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta" && event.delta.text) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      },
    });
    return new Response(readable, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  if (model.startsWith("gemini-")) {
    if (!GEMINI_API_KEY) {
      console.error("[ai-coach] GOOGLE_GEMINI_API_KEY is not set");
      return new Response("AI service is not configured. Please contact an administrator.", { status: 503 });
    }
    const gemini = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    let stream: AsyncIterable<any>;
    try {
      stream = await gemini.models.generateContentStream({
        model,
        contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        config: { systemInstruction: systemPrompt, maxOutputTokens: 1500, temperature: 0.4 },
      });
    } catch (err: any) {
      console.error("[ai-coach] Gemini stream init failed:", err?.message ?? err);
      return new Response(`AI error: ${err?.message ?? "Unknown error"}`, { status: 502 });
    }
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.text ?? "";
            if (text) controller.enqueue(encoder.encode(text));
          }
        } catch (err: any) {
          console.error("[ai-coach] Gemini stream read failed:", err?.message ?? err);
          controller.enqueue(encoder.encode("\n\n[AI error — please try again]"));
        }
        controller.close();
      },
    });
    return new Response(readable, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  // Default: OpenAI
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 15_000 });
  const stream = await openai.chat.completions.create({
    model,
    stream: true,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    max_tokens: 1500,
    temperature: 0.4,
  });
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? "";
        if (text) controller.enqueue(encoder.encode(text));
      }
      controller.close();
    },
  });
  return new Response(readable, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
