import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { z } from "zod";

const schema = z.object({
  lessonId: z.string().uuid(),
  existingId: z.string().uuid().optional().nullable(),
  questions: z.array(z.object({
    question: z.string(),
    options: z.array(z.string()),
    correct: z.number().int().min(0),
  })),
  use_bank: z.boolean(),
  bank_count: z.number().int().min(1).max(50),
});

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "course_creator", "course_manager"].includes(profile?.role ?? "")) {
    return new Response("Forbidden", { status: 403 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const { lessonId, existingId, questions, use_bank, bank_count } = parsed.data;

  // A quiz is course content: the caller must be an editor OF THIS LESSON'S COURSE,
  // not merely hold an editor role globally. assertCourseOwner covers admins, the
  // creator, and linked creators/managers for this specific course.
  const { data: lesson } = await admin.from("lessons").select("course_id").eq("id", lessonId).single();
  if (!lesson) return new Response("Lesson not found", { status: 404 });
  const ownerErr = await assertCourseOwner(lesson.course_id, user.id);
  if (ownerErr) return ownerErr;

  const payload = { questions, use_bank, bank_count };

  if (existingId) {
    // Scope by lesson_id so an existing quiz on another lesson can't be repointed here.
    const { error } = await admin.from("quizzes").update(payload).eq("id", existingId).eq("lesson_id", lessonId);
    if (error) return new Response(error.message, { status: 500 });
  } else {
    const { error } = await admin.from("quizzes").insert({ lesson_id: lessonId, ...payload });
    if (error) return new Response(error.message, { status: 500 });
  }

  return new Response("OK");
}
