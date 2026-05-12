import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const schema = z.object({
  lessonId: z.string().uuid(),
  courseId: z.string().uuid(),
  completed: z.boolean(),
});

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const { lessonId, courseId, completed } = parsed.data;
  const admin = createAdminClient();

  // Verify the lesson belongs to the specified course
  const { data: lesson } = await admin
    .from("lessons")
    .select("course_id")
    .eq("id", lessonId)
    .single();

  if (!lesson || lesson.course_id !== courseId) {
    return new Response("Lesson not found in this course", { status: 404 });
  }

  // Verify enrollment before allowing progress changes
  const { data: enrollment } = await admin
    .from("enrollments")
    .select("id")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .maybeSingle();

  if (!enrollment) return new Response("Not enrolled in this course", { status: 403 });

  if (completed) {
    const { error } = await admin
      .from("progress")
      .upsert({ user_id: user.id, lesson_id: lessonId }, { onConflict: "user_id,lesson_id" });
    if (error) {
      console.error("[lessons/progress] upsert failed", error);
      return Response.json({ error: "Failed to save progress" }, { status: 500 });
    }
  } else {
    const { error } = await admin
      .from("progress")
      .delete()
      .eq("user_id", user.id)
      .eq("lesson_id", lessonId);
    if (error) {
      console.error("[lessons/progress] delete failed", error);
      return Response.json({ error: "Failed to update progress" }, { status: 500 });
    }
  }

  return Response.json({ ok: true });
}
