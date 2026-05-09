import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { z } from "zod";

const schema = z.object({
  quizId: z.string().uuid(),
  lessonId: z.string().uuid(),
  courseId: z.string().uuid(),
  answers: z.array(z.number().int().min(0).max(10)),
  score: z.number().int().min(0).max(100),
});

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { allowed } = await checkRateLimit(`quiz-submit:${user.id}`, 30, 60 * 60_000);
  if (!allowed) return rateLimitResponse({ limit: 30, windowSecs: 3600 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const { quizId, lessonId, courseId, answers, score } = parsed.data;

  const admin = createAdminClient();

  // Verify quiz belongs to the stated lesson and lesson belongs to stated course
  const { data: quiz } = await admin
    .from("quizzes")
    .select("id, max_attempts, lesson_id, lessons(course_id)")
    .eq("id", quizId)
    .eq("lesson_id", lessonId)
    .single();

  if (!quiz) return new Response("Quiz not found", { status: 404 });
  if ((quiz.lessons as any)?.course_id !== courseId)
    return new Response("Course mismatch", { status: 403 });

  // Verify enrollment (staff can always submit)
  const [{ data: enrollment }, { data: profile }] = await Promise.all([
    admin.from("enrollments").select("id").eq("user_id", user.id).eq("course_id", courseId).maybeSingle(),
    admin.from("profiles").select("role").eq("id", user.id).single(),
  ]);
  const isStaff = ["admin", "course_creator", "course_manager"].includes(profile?.role ?? "");
  if (!enrollment && !isStaff) return new Response("Not enrolled", { status: 403 });

  // Enforce max_attempts if set
  const maxAttempts: number | null = (quiz as any).max_attempts ?? null;
  if (maxAttempts !== null) {
    const { count } = await admin
      .from("quiz_responses")
      .select("id", { count: "exact", head: true })
      .eq("quiz_id", quizId)
      .eq("user_id", user.id);
    if ((count ?? 0) >= maxAttempts) {
      return new Response(
        JSON.stringify({ error: "Maximum attempts reached", maxAttempts }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  const { error } = await admin.from("quiz_responses").insert({
    quiz_id: quizId,
    user_id: user.id,
    answers,
    score,
  });

  if (error) {
    console.error("[quiz-submit]", error);
    return new Response("Failed to save response", { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
