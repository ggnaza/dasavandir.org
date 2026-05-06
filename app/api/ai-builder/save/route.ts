import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const quizQuestionSchema = z.object({
  question: z.string().min(1).max(1000),
  options: z.array(z.string().max(500)).length(4),
  correct: z.number().int().min(0).max(3),
});

const lessonSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().max(50_000),
  quiz: z.object({ questions: z.array(quizQuestionSchema).max(20) }).optional(),
});

const saveSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000),
  lessons: z.array(lessonSchema).min(1).max(30),
});

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "course_creator"].includes(profile?.role ?? "")) return new Response("Forbidden", { status: 403 });

  const parsed = saveSchema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const { title, description, lessons } = parsed.data;

  const { data: course, error: courseError } = await admin
    .from("courses")
    .insert({ title, description, created_by: user.id, published: false })
    .select("id")
    .single();

  if (courseError) {
    console.error("[ai-builder/save course]", courseError);
    return new Response("Failed to create course", { status: 500 });
  }

  for (let i = 0; i < lessons.length; i++) {
    const lesson = lessons[i];

    const { data: lessonRow, error: lessonError } = await admin
      .from("lessons")
      .insert({ course_id: course.id, title: lesson.title, content: lesson.content, order: i + 1 })
      .select("id")
      .single();

    if (lessonError) continue;

    if (lesson.quiz?.questions?.length) {
      await admin.from("quizzes").insert({ lesson_id: lessonRow.id, questions: lesson.quiz.questions });
    }
  }

  return Response.json({ courseId: course.id });
}
