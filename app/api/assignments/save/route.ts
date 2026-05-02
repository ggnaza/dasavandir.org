import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { z } from "zod";

const EDITOR_ROLES = ["admin", "course_creator", "course_manager"];

const rubricItemSchema = z.object({
  criterion: z.string().min(1).max(200),
  description: z.string().max(1000),
  max_points: z.number().int().min(0).max(1000),
});

const saveSchema = z.object({
  id: z.string().uuid().optional(),
  lesson_id: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  instructions: z.string().max(20_000),
  rubric: z.array(rubricItemSchema).min(1).max(20),
});

const deleteSchema = z.object({
  id: z.string().uuid(),
});

async function getCourseIdForLesson(admin: any, lessonId: string): Promise<string | null> {
  const { data } = await admin.from("lessons").select("course_id").eq("id", lessonId).single();
  return data?.course_id ?? null;
}

async function getCourseIdForAssignment(admin: any, assignmentId: string): Promise<string | null> {
  const { data } = await admin
    .from("assignments")
    .select("lesson_id, lessons(course_id)")
    .eq("id", assignmentId)
    .single();
  return (data?.lessons as any)?.course_id ?? null;
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!EDITOR_ROLES.includes(profile?.role ?? "")) return new Response("Forbidden", { status: 403 });

  const parsed = saveSchema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const { id, lesson_id, title, instructions, rubric } = parsed.data;

  const courseId = id
    ? await getCourseIdForAssignment(admin, id)
    : lesson_id ? await getCourseIdForLesson(admin, lesson_id) : null;

  if (!courseId) return new Response("Course not found", { status: 404 });

  const ownerErr = await assertCourseOwner(courseId, user.id);
  if (ownerErr) return ownerErr;

  if (id) {
    const { error } = await admin.from("assignments").update({ title, instructions, rubric }).eq("id", id);
    if (error) {
      console.error("[assignments/save update]", error);
      return new Response("Failed to update assignment", { status: 500 });
    }
  } else {
    const { error } = await admin.from("assignments").insert({ lesson_id, title, instructions, rubric });
    if (error) {
      console.error("[assignments/save insert]", error);
      return new Response("Failed to create assignment", { status: 500 });
    }
  }

  return new Response("OK");
}

export async function DELETE(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!EDITOR_ROLES.includes(profile?.role ?? "")) return new Response("Forbidden", { status: 403 });

  const parsed = deleteSchema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const courseId = await getCourseIdForAssignment(admin, parsed.data.id);
  if (!courseId) return new Response("Assignment not found", { status: 404 });

  const ownerErr = await assertCourseOwner(courseId, user.id);
  if (ownerErr) return ownerErr;

  await admin.from("assignments").delete().eq("id", parsed.data.id);
  return new Response("OK");
}
