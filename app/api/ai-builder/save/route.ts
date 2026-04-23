import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return new Response("Forbidden", { status: 403 });

  const { title, description, lessons } = await req.json();

  // Create course
  const { data: course, error: courseError } = await admin
    .from("courses")
    .insert({ title, description, created_by: user.id, published: false })
    .select("id")
    .single();

  if (courseError) return new Response(courseError.message, { status: 500 });

  // Create lessons + quizzes
  for (let i = 0; i < lessons.length; i++) {
    const lesson = lessons[i];

    const { data: lessonRow, error: lessonError } = await admin
      .from("lessons")
      .insert({
        course_id: course.id,
        title: lesson.title,
        content: lesson.content,
        order: i + 1,
      })
      .select("id")
      .single();

    if (lessonError) continue;

    if (lesson.quiz?.questions?.length) {
      await admin.from("quizzes").insert({
        lesson_id: lessonRow.id,
        questions: lesson.quiz.questions,
      });
    }
  }

  return Response.json({ courseId: course.id });
}
