import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { z } from "zod";

const EDITOR_ROLES = ["admin", "course_creator", "course_manager"];

const saveSchema = z.object({
  lesson_id: z.string().uuid(),
  file_name: z.string().min(1).max(255),
  storage_path: z.string().min(1).max(500),
});

const deleteSchema = z.object({
  id: z.string().uuid(),
});

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!EDITOR_ROLES.includes(profile?.role ?? "")) return new Response("Forbidden", { status: 403 });

  const parsed = saveSchema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const { lesson_id, file_name, storage_path } = parsed.data;

  const { data: lesson } = await admin.from("lessons").select("course_id").eq("id", lesson_id).single();
  if (!lesson) return new Response("Lesson not found", { status: 404 });

  const ownerErr = await assertCourseOwner(lesson.course_id, user.id);
  if (ownerErr) return ownerErr;

  const { data, error } = await admin
    .from("lesson_files")
    .insert({ lesson_id, file_name, storage_path })
    .select()
    .single();

  if (error) {
    console.error("[files/record]", error);
    return new Response("Failed to record file", { status: 500 });
  }

  return Response.json(data);
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

  // Look up course_id via lesson to verify ownership
  const { data: file } = await admin
    .from("lesson_files")
    .select("lesson_id, lessons(course_id)")
    .eq("id", parsed.data.id)
    .single();

  if (!file) return new Response("File not found", { status: 404 });

  const ownerErr = await assertCourseOwner((file.lessons as any)?.course_id, user.id);
  if (ownerErr) return ownerErr;

  await admin.from("lesson_files").delete().eq("id", parsed.data.id);
  return new Response("OK");
}
