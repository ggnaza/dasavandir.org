import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getAIModel, callLLM, GEMINI_API_KEY } from "@/lib/llm";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const chatSchema = z.object({
  lessonId: z.string().uuid(),
  courseId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional().nullable(),
  newSession: z.boolean().optional().default(false),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(50_000),
  })).max(100),
});

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // Per-minute burst limit
  const { allowed } = await checkRateLimit(`chat:${user.id}`, 20, 60_000);
  if (!allowed) return rateLimitResponse({ limit: 20, windowSecs: 60 });

  // Daily cap — prevents runaway AI costs
  const { allowed: dailyOk } = await checkRateLimit(`chat-daily:${user.id}`, 200, 24 * 60 * 60_000);
  if (!dailyOk) return rateLimitResponse({ limit: 200, windowSecs: 86400 });

  const parsed = chatSchema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });
  const { messages, lessonId, courseId, sessionId: requestedSessionId, newSession } = parsed.data;
  const userId = user.id;

  const admin = createAdminClient();

  const model = await getAIModel();

  // Load lesson + course context
  const { data: lesson } = await admin
    .from("lessons")
    .select("title, content, slides_text, document_text, video_url, course_id, courses(title, description)")
    .eq("id", lessonId)
    .single();

  const courseTitle = (lesson?.courses as any)?.title ?? "";
  const courseDesc = (lesson?.courses as any)?.description ?? "";
  const effectiveCourseId = courseId ?? lesson?.course_id;

  // Always resolve courseId — fall back to the lesson's own course_id
  const resolvedCourseId = effectiveCourseId ?? lesson?.course_id;

  // Verify the user is enrolled in this course (or is an admin/creator)
  let learnerFirstName = "";
  let customCoachInstructions = "";
  if (resolvedCourseId) {
    const [{ data: enrollment }, { data: profile }, { data: courseSettings }] = await Promise.all([
      admin.from("enrollments").select("id").eq("user_id", user.id).eq("course_id", resolvedCourseId).maybeSingle(),
      admin.from("profiles").select("role, full_name").eq("id", user.id).single(),
      admin.from("courses").select("ai_coach_enabled, ai_coach_instructions").eq("id", resolvedCourseId).single(),
    ]);
    const isStaff = ["admin", "course_creator", "course_manager"].includes(profile?.role ?? "");
    if (!enrollment && !isStaff) return new Response("Not enrolled in this course", { status: 403 });
    // Block if AI Coach is disabled for this course (admins/creators can still test it)
    if (courseSettings?.ai_coach_enabled === false && !isStaff) {
      return new Response("AI Coach is not enabled for this course", { status: 403 });
    }
    learnerFirstName = profile?.full_name?.split(" ")[0]?.trim() ?? "";
    customCoachInstructions = (courseSettings as any)?.ai_coach_instructions?.trim() ?? "";
  } else {
    return new Response("Course not found", { status: 404 });
  }

  // Resolve or create session before streaming so we have an ID for message saving
  const sessionId = await resolveSession(admin, userId, resolvedCourseId!, lessonId, requestedSessionId ?? null, newSession ?? false);

  // Read how many exchanges have happened in this session so we can adapt coaching mode
  const { data: sessionData } = sessionId
    ? await admin.from("ai_coach_sessions").select("message_count").eq("id", sessionId).single()
    : { data: null };
  const exchangesSoFar = Math.floor((sessionData?.message_count ?? 0) / 2);
  // exchangesSoFar = number of completed coach responses in this session (before this one)

  // Save the user's message (last in array) immediately
  const userMessage = messages[messages.length - 1];
  if (sessionId && userMessage?.role === "user") {
    await admin.from("ai_coach_messages").insert({
      session_id: sessionId,
      user_id: userId,
      course_id: resolvedCourseId,
      role: "user",
      content: userMessage.content,
    }).then(undefined, () => {});
  }

  // Load all lessons for context + learner data
  const { data: allLessons } = await admin
    .from("lessons")
    .select("id, title, content, slides_text, document_text, order")
    .eq("course_id", lesson?.course_id)
    .order("order");

  const allLessonIds = (allLessons ?? []).map((l: { id: string }) => l.id);
  const otherLessons = (allLessons ?? []).filter((l: { id: string }) => l.id !== lessonId);

  // Learner data: progress, quiz scores, submissions, announcements
  const [
    { data: progressRows },
    { data: allQuizzes },
    { data: allAssignments },
    { data: recentAnnouncements },
  ] = await Promise.all([
    allLessonIds.length > 0
      ? admin.from("progress").select("lesson_id").eq("user_id", userId).in("lesson_id", allLessonIds)
      : Promise.resolve({ data: [] }),
    allLessonIds.length > 0
      ? admin.from("quizzes").select("id, lesson_id").in("lesson_id", allLessonIds)
      : Promise.resolve({ data: [] }),
    allLessonIds.length > 0
      ? admin.from("assignments").select("id, lesson_id, title, max_score").in("lesson_id", allLessonIds)
      : Promise.resolve({ data: [] }),
    resolvedCourseId
      ? admin.from("announcements").select("title, body, created_at").eq("course_id", resolvedCourseId).order("created_at", { ascending: false }).limit(3)
      : Promise.resolve({ data: [] }),
  ]);

  const completedLessonIds = new Set((progressRows ?? []).map((p: { lesson_id: string }) => p.lesson_id));
  const completedCount = completedLessonIds.size;
  const totalLessons = (allLessons ?? []).length;

  // Quiz scores per lesson
  const quizIdToLessonId = Object.fromEntries((allQuizzes ?? []).map((q: { id: string; lesson_id: string }) => [q.id, q.lesson_id]));
  const quizIds = (allQuizzes ?? []).map((q: { id: string }) => q.id);
  const { data: quizResponses } = quizIds.length > 0
    ? await admin.from("quiz_responses").select("quiz_id, score").eq("user_id", userId).in("quiz_id", quizIds).order("submitted_at", { ascending: false })
    : { data: [] };

  // Latest score per lesson (quiz)
  const quizScoreByLesson: Record<string, number> = {};
  for (const r of quizResponses ?? []) {
    const lid = quizIdToLessonId[r.quiz_id];
    if (lid && quizScoreByLesson[lid] === undefined) {
      quizScoreByLesson[lid] = r.score ?? 0;
    }
  }

  // Submission status per assignment
  const assignmentIds = (allAssignments ?? []).map((a: { id: string }) => a.id);
  const { data: submissions } = assignmentIds.length > 0
    ? await admin.from("submissions").select("assignment_id, status, final_score, ai_total_score, feedback").eq("user_id", userId).in("assignment_id", assignmentIds)
    : { data: [] };

  const submissionByAssignment = Object.fromEntries(
    (submissions ?? []).map((s: { assignment_id: string; status: string; final_score: number | null; ai_total_score: number | null; feedback: string | null }) => [s.assignment_id, s])
  );

  // Build learner snapshot text
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const lessonListText = (allLessons ?? []).map((l: { id: string; title: string; order: number }) => {
    const done = completedLessonIds.has(l.id) ? "✓" : "○";
    const score = quizScoreByLesson[l.id] !== undefined ? ` | quiz: ${quizScoreByLesson[l.id]}%` : "";
    const link = `${siteUrl}/learn/courses/${resolvedCourseId}/lessons/${l.id}`;
    return `  ${done} Lesson ${l.order}: ${l.title}${score} — ${link}`;
  }).join("\n");

  const assignmentText = (allAssignments ?? []).map((a: { id: string; lesson_id: string; title: string; max_score: number }) => {
    const sub = submissionByAssignment[a.id];
    if (!sub) return `  • ${a.title}: not submitted`;
    const score = sub.final_score ?? sub.ai_total_score;
    const scoreStr = score !== null ? ` (${score}/${a.max_score})` : "";
    const feedbackStr = sub.feedback ? ` — feedback: "${sub.feedback.slice(0, 150)}"` : "";
    return `  • ${a.title}: ${sub.status}${scoreStr}${feedbackStr}`;
  }).join("\n");

  const announcementsText = (recentAnnouncements ?? []).length > 0
    ? (recentAnnouncements ?? []).map((a: { title: string; body: string; created_at: string }) =>
        `  [${new Date(a.created_at).toLocaleDateString()}] ${a.title}: ${a.body.slice(0, 100)}`
      ).join("\n")
    : "  (none)";

  const platformLinksText = `  • Course overview: ${siteUrl}/learn/courses/${resolvedCourseId}
  • My submissions & feedback: ${siteUrl}/learn/courses/${resolvedCourseId}/feedback
  • My journal: ${siteUrl}/learn/courses/${resolvedCourseId}/journal
  • Resources: ${siteUrl}/learn/courses/${resolvedCourseId}/resources
  • Announcements: ${siteUrl}/learn/announcements`;

  const learnerDataBlock = `
════════════════════════════════════════
LEARNER PROGRESS DATA (real-time, current session)
════════════════════════════════════════
Completion: ${completedCount}/${totalLessons} lessons

Lessons:
${lessonListText || "  (none)"}

Assignments:
${assignmentText || "  (no assignments in this course)"}

Recent announcements from instructors:
${announcementsText}

Platform links (share if relevant):
${platformLinksText}
════════════════════════════════════════`;

  // Load course-level supplementary resources for AI context
  let courseResourcesText = "";
  if (effectiveCourseId) {
    const { data: resources } = await admin
      .from("course_resources")
      .select("title, url, file_name, extracted_text")
      .eq("course_id", effectiveCourseId)
      .order("created_at");
    if (resources?.length) {
      courseResourcesText = resources
        .map((r) => {
          const ref = r.url ? `(${r.url})` : r.file_name ? `(${r.file_name})` : "";
          const body = r.extracted_text?.trim() ?? "";
          return body
            ? `### ${r.title} ${ref}\n${body.slice(0, 3000)}`
            : `### ${r.title} ${ref}\n(no text extracted)`;
        })
        .join("\n\n")
        .slice(0, 8000);
    }
  }

  // Load AI memory for this user+course
  let memoryContext = "";
  if (effectiveCourseId && userId) {
    const { data: memory } = await admin
      .from("ai_coach_memory")
      .select("summary")
      .eq("user_id", userId)
      .eq("course_id", effectiveCourseId)
      .single();
    if (memory?.summary) {
      memoryContext = memory.summary;
    }
  }

  function lessonToText(l: { title: string; content: string | null; slides_text: string | null; document_text: string | null }) {
    const text = (l.content ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const slides = (l.slides_text ?? "").trim();
    const doc = (l.document_text ?? "").trim();
    const combined = [text, slides, doc].filter(Boolean).join("\n").slice(0, 3000);
    return combined ? `### ${l.title}\n${combined}` : `### ${l.title}\n(visual/video content)`;
  }

  const currentText = (lesson?.content ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const currentSlides = (lesson as any)?.slides_text ?? "";
  const currentDoc = (lesson as any)?.document_text ?? "";
  const currentCombined = [currentText, currentSlides, currentDoc].filter(Boolean).join("\n").slice(0, 12000);

  const otherLessonsText = otherLessons.map(lessonToText).join("\n\n").slice(0, 8000);

  const systemPrompt = `You are an AI Coach for the course "${courseTitle}" — a professional development program for teacher-leaders.
${courseDesc ? `Course description: ${courseDesc}` : ""}
${learnerFirstName ? `The teacher-leader's name is ${learnerFirstName}. Address them by first name naturally — once or twice per conversation.` : ""}
They are currently working on: "${lesson?.title ?? ""}".

════════════════════════════════════════
COURSE MATERIALS — your ONLY source of truth
════════════════════════════════════════
Current lesson:
${currentCombined || "(visual/video content — no text extracted)"}

Other lessons in this course:
${otherLessonsText || "(none yet)"}
${courseResourcesText ? `\nSupplementary resources:\n${courseResourcesText}` : ""}
${memoryContext ? `\nMemory from previous sessions:\n${memoryContext}` : ""}
${learnerDataBlock}

YOUR ROLE:

${customCoachInstructions ? customCoachInstructions : `You are a professional development coach. You use Socratic coaching by default, but you adapt based on where the teacher-leader is in the conversation and how they're responding.

${exchangesSoFar < 3 ? `CURRENT MODE: SOCRATIC (exchange ${exchangesSoFar + 1} of 3)
You are in Socratic mode. Do NOT give direct answers yet. When a teacher-leader shares their work, always respond with this three-part framework:

**1. Analytical Reflection**
A brief, neutral summary of the core pedagogical choices you detect in their submission — noting whether the stated intentions match what is actually on the page. No praise, no criticism. Just reflection back to them.

**2. Metacognitive Awareness**
2–3 probing questions that unpack the *how* and *why* behind their choices. These questions should surface assumptions, biases, or unexplored reasoning. Examples: "What made you choose this framework over others?" / "How did your students' prior knowledge shape this design?" / "What bias might be present in this approach?"

**3. Actionable Improvement**
One single, targeted guiding question — not a suggestion — that challenges them to refine one specific area before finalizing their work. It must be a question, not a directive.

EXCEPTION — Direct mode override: If the teacher-leader explicitly signals frustration or asks for a direct answer (e.g. "just tell me", "I don't know", "what should I do", "I give up", "can you just explain it"), skip the framework and switch to DIRECT MODE immediately (see below).` : `CURRENT MODE: DIRECT
You have completed 3 Socratic exchanges with this teacher-leader. The scaffolding is now optional — you may give direct, concrete answers, explanations, and suggestions. You do not need to use the three-part framework unless it genuinely adds value.

You can still ask a follow-up question if helpful, but do not withhold useful information. Be a knowledgeable colleague, not a gatekeeper. Give them what they need to move forward.

If they share new work (a new artifact or draft), you may briefly re-enter Socratic mode for that specific piece before offering direct feedback — but keep it to one round of questions, then be direct.`}

DIRECT MODE behavior (used when mode is DIRECT or when override is triggered):
- Give clear, specific, actionable answers grounded in the course materials
- Point to concrete improvements, examples, or frameworks by name
- You may evaluate quality honestly: "This section is strong because… This part could be clearer because…"
- Still never invent facts — ground everything in the course materials or flag external references

ALWAYS:
- NEVER grade or evaluate quality in Socratic mode ("this is good", "this is weak")
- If they share something unrelated to professional development, gently redirect to their coursework
- Ground all responses in what the teacher-leader actually wrote and the course materials above`}

ANTI-HALLUCINATION:
- Do NOT present invented facts, statistics, or frameworks as though they are verified
- You MAY reference external research or resources — but ALWAYS prefix with: "⚠️ This resource has not been verified by Teach for Armenia:"

LANGUAGE: Always reply in the same language the teacher-leader writes in. Armenian in → Armenian out. Never mix languages.

FORMAT: ${customCoachInstructions ? "Use natural, readable prose. No forced headings unless they genuinely help structure the response." : "In Socratic mode, use **bold** for the three section headings. In Direct mode, use natural prose — no forced headings."} Keep responses readable in under 2 minutes.`;

  const encoder = new TextEncoder();
  let fullReply = "";

  if (model.startsWith("claude-")) {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("[chat] ANTHROPIC_API_KEY is not set");
      return new Response("AI service is not configured. Please contact an administrator.", { status: 503 });
    }
    let stream: ReturnType<Anthropic["messages"]["stream"]>;
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      stream = anthropic.messages.stream({
        model,
        max_tokens: 1200,
        temperature: 0.3,
        system: systemPrompt,
        messages: messages.map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      });
    } catch (err: any) {
      console.error("[chat] Anthropic stream init failed:", err?.message ?? err);
      return new Response(`AI error: ${err?.message ?? "Unknown error"}`, { status: 502 });
    }

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              const text = event.delta.text;
              if (text) {
                fullReply += text;
                controller.enqueue(encoder.encode(text));
              }
            }
          }
        } catch (err: any) {
          console.error("[chat] Anthropic stream read failed:", err?.message ?? err);
          controller.enqueue(encoder.encode("\n\n[AI error — please try again]"));
        }
        controller.close();
        if (effectiveCourseId && fullReply) {
          if (sessionId) {
            saveAssistantMessage(admin, sessionId, userId, effectiveCourseId, fullReply).catch(() => {});
            updateSessionAfterReply(admin, sessionId).catch(() => {});
          }
          updateMemory(admin, userId, effectiveCourseId, messages, fullReply, memoryContext).catch(() => {});
        }
      },
    });

    return new Response(readable, { headers: { "Content-Type": "text/plain; charset=utf-8", "X-Session-Id": sessionId ?? "" } });
  }

  if (model.startsWith("gemini-")) {
    if (!GEMINI_API_KEY) {
      console.error("[chat] Gemini API key (GOOGLE_GEMINI_API_KEY or GOOGLE_API_KEY) is not set");
      return new Response("AI service is not configured. Please contact an administrator.", { status: 503 });
    }
    const gemini = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const geminiMessages = messages.map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    let stream: AsyncIterable<any>;
    try {
      stream = await gemini.models.generateContentStream({
        model,
        contents: geminiMessages,
        config: {
          systemInstruction: systemPrompt,
          maxOutputTokens: 1200,
          temperature: 0.3,
          ...(model.includes("flash") ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      });
    } catch (err: any) {
      console.error("[chat] Gemini stream init failed:", err?.message ?? err);
      return new Response(`AI error: ${err?.message ?? "Unknown error"}`, { status: 502 });
    }

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.text ?? "";
            if (text) {
              fullReply += text;
              controller.enqueue(encoder.encode(text));
            }
          }
        } catch (err: any) {
          console.error("[chat] Gemini stream read failed:", err?.message ?? err);
          controller.enqueue(encoder.encode("\n\n[AI error — please try again]"));
        }
        controller.close();

        if (effectiveCourseId && fullReply) {
          if (sessionId) {
            saveAssistantMessage(admin, sessionId, userId, effectiveCourseId, fullReply).catch(() => {});
            updateSessionAfterReply(admin, sessionId).catch(() => {});
          }
          updateMemory(admin, userId, effectiveCourseId, messages, fullReply, memoryContext).catch(() => {});
        }
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Session-Id": sessionId ?? "" },
    });
  }

  // Default: OpenAI
  if (!process.env.OPENAI_API_KEY) {
    console.error("[chat] OPENAI_API_KEY is not set");
    return new Response("AI service is not configured. Please contact an administrator.", { status: 503 });
  }

  let stream: Awaited<ReturnType<OpenAI["chat"]["completions"]["create"]>>;
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 15_000 });
    stream = await openai.chat.completions.create({
      model,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      max_tokens: 1200,
      temperature: 0.3,
    });
  } catch (err: any) {
    console.error("[chat] OpenAI stream init failed:", err?.message ?? err);
    return new Response(`AI error: ${err?.message ?? "Unknown error"}`, { status: 502 });
  }

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) {
            fullReply += text;
            controller.enqueue(encoder.encode(text));
          }
        }
      } catch (err: any) {
        console.error("[chat] OpenAI stream read failed:", err?.message ?? err);
        controller.enqueue(encoder.encode("\n\n[AI error — please try again]"));
      }
      controller.close();

      if (effectiveCourseId && fullReply) {
        if (sessionId) {
          saveAssistantMessage(admin, sessionId, userId, effectiveCourseId, fullReply).catch(() => {});
          updateSessionAfterReply(admin, sessionId).catch(() => {});
        }
        updateMemory(admin, userId, effectiveCourseId, messages, fullReply, memoryContext).catch(() => {});
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "X-Session-Id": sessionId ?? "" },
  });
}

async function resolveSession(
  admin: any,
  userId: string,
  courseId: string,
  lessonId: string,
  requestedSessionId: string | null,
  newSession: boolean,
): Promise<string | null> {
  // Session tracking is best-effort — if the table is missing or an insert
  // fails, we must NOT take down the whole chat. Return null and let the
  // caller stream the AI response without persisting history.
  try {
    // Explicit session from client — verify ownership and reuse it
    if (requestedSessionId && !newSession) {
      const { data } = await admin
        .from("ai_coach_sessions")
        .select("id")
        .eq("id", requestedSessionId)
        .eq("user_id", userId)
        .eq("course_id", courseId)
        .maybeSingle();
      if (data) return data.id;
    }

    // New session explicitly requested — always create fresh
    if (newSession) {
      const { data } = await admin
        .from("ai_coach_sessions")
        .insert({ user_id: userId, course_id: courseId, lesson_id: lessonId, started_at: new Date().toISOString(), last_message_at: new Date().toISOString(), message_count: 0 })
        .select("id").single();
      return data?.id ?? null;
    }

    // Auto-continue: reuse an open session within the last 30 minutes
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: existing } = await admin
      .from("ai_coach_sessions")
      .select("id")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .gte("last_message_at", thirtyMinutesAgo)
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) return existing.id;

    // Create a new session
    const { data } = await admin
      .from("ai_coach_sessions")
      .insert({ user_id: userId, course_id: courseId, lesson_id: lessonId, started_at: new Date().toISOString(), last_message_at: new Date().toISOString(), message_count: 0 })
      .select("id").single();
    return data?.id ?? null;
  } catch (err: any) {
    console.error("[chat] resolveSession failed (history disabled for this turn):", err?.message ?? err);
    return null;
  }
}

async function saveAssistantMessage(admin: any, sessionId: string, userId: string, courseId: string, content: string) {
  await admin.from("ai_coach_messages").insert({ session_id: sessionId, user_id: userId, course_id: courseId, role: "assistant", content });
}

async function updateSessionAfterReply(admin: any, sessionId: string) {
  const { data: session } = await admin.from("ai_coach_sessions").select("message_count").eq("id", sessionId).single();
  await admin.from("ai_coach_sessions").update({
    message_count: (session?.message_count ?? 0) + 2, // user + assistant
    last_message_at: new Date().toISOString(),
  }).eq("id", sessionId);
}

// Legacy — kept for reference but no longer called; replaced by resolveSession + updateSessionAfterReply
async function logCoachSession(
  admin: any,
  userId: string,
  courseId: string,
  lessonId: string,
) {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  // Find open session within the last 30 minutes
  const { data: existing } = await admin
    .from("ai_coach_sessions")
    .select("id, message_count")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .gte("last_message_at", thirtyMinutesAgo)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    await admin
      .from("ai_coach_sessions")
      .update({
        message_count: existing.message_count + 1,
        last_message_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await admin.from("ai_coach_sessions").insert({
      user_id: userId,
      course_id: courseId,
      lesson_id: lessonId,
      started_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
      message_count: 1,
    });
  }
}

async function updateMemory(
  admin: any,
  userId: string,
  courseId: string,
  messages: any[],
  latestReply: string,
  existingMemory: string,
) {
  // Only update every 4 messages to avoid too many calls
  if (messages.length % 4 !== 0) return;

  const recentExchange = messages.slice(-4).map((m: any) => `${m.role}: ${m.content}`).join("\n");
  const prompt = `You are summarizing what a learner has discussed with an AI tutor.

${existingMemory ? `Existing memory:\n${existingMemory}\n\n` : ""}Recent conversation:
${recentExchange}
AI: ${latestReply}

Update the memory summary (max 300 words). Include:
- Topics they struggled with or found confusing
- Concepts they already understand well
- Questions they asked
- Their learning style or language preference

Be concise. Write as bullet points. This summary will be shown to the AI tutor in future sessions.`;

  try {
    const model = await getAIModel();
    const newMemory = await callLLM(model, "You are a concise summarizer. Return only the updated memory as bullet points.", prompt, { maxTokens: 400, temperature: 0.3 });
    if (newMemory) {
      await admin.from("ai_coach_memory").upsert(
        { user_id: userId, course_id: courseId, summary: newMemory, updated_at: new Date().toISOString() },
        { onConflict: "user_id,course_id" }
      );
    }
  } catch { /* silent fail */ }
}
