import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { z } from "zod";

const EDITOR_ROLES = ["admin", "course_creator", "course_manager"];

const questionSchema = z.object({
  question: z.string().max(1000),
  options: z.array(z.string().max(500)).length(4),
  correct: z.number().int().min(0).max(3),
});

const schema = z.object({
  lessonId: z.string().uuid(),
  chapters: z.array(z.object({
    id: z.string(),
    title: z.string().max(200),
    start: z.number().int().min(0),
    end: z.number().int().min(0),
    questions: z.array(questionSchema).max(50).default([]),
  })).max(100),
});

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!EDITOR_ROLES.includes(profile?.role ?? "")) return new Response("Forbidden", { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const { lessonId, chapters } = parsed.data;

  // Verify the user owns the course this lesson belongs to
  const { data: lesson } = await admin.from("lessons").select("course_id").eq("id", lessonId).single();
  if (!lesson) return new Response("Lesson not found", { status: 404 });

  const ownerErr = await assertCourseOwner(lesson.course_id, user.id);
  if (ownerErr) return ownerErr;

  const { error } = await admin.from("lessons").update({ chapters }).eq("id", lessonId);
  if (error) {
    console.error("[chapters/save]", error);
    return new Response("Failed to save chapters", { status: 500 });
  }

  return new Response("ok");
}
