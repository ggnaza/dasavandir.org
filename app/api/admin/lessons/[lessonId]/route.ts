import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { z } from "zod";

const updateSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  content: z.string().optional(),
  video_url: z.string().max(2000).nullable().optional(),
  audio_url: z.string().max(2000).nullable().optional(),
  document_url: z.string().max(2000).nullable().optional(),
  slides_url: z.string().max(2000).nullable().optional(),
  what_you_learn: z.string().max(2000).nullable().optional(),
  skills: z.array(z.string()).nullable().optional(),
  deadline_days: z.number().nullable().optional(),
  deadline_date: z.string().nullable().optional(),
  links: z.array(z.object({ label: z.string(), url: z.string() })).optional(),
  duration_seconds: z.number().nullable().optional(),
});

async function getCourseId(admin: any, lessonId: string): Promise<string | null> {
  const { data } = await admin.from("lessons").select("course_id").eq("id", lessonId).single();
  return data?.course_id ?? null;
}

// PATCH /api/admin/lessons/[lessonId] — update lesson fields
export async function PATCH(req: Request, { params }: { params: { lessonId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const courseId = await getCourseId(admin, params.lessonId);
  if (!courseId) return new Response("Lesson not found", { status: 404 });

  const ownerErr = await assertCourseOwner(courseId, user.id);
  if (ownerErr) return ownerErr;

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const { error } = await admin.from("lessons").update(parsed.data).eq("id", params.lessonId);
  if (error) return new Response(error.message, { status: 500 });
  return new Response("OK");
}

// DELETE /api/admin/lessons/[lessonId] — delete a lesson
export async function DELETE(req: Request, { params }: { params: { lessonId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const courseId = await getCourseId(admin, params.lessonId);
  if (!courseId) return new Response("Lesson not found", { status: 404 });

  const ownerErr = await assertCourseOwner(courseId, user.id);
  if (ownerErr) return ownerErr;

  const { error } = await admin.from("lessons").delete().eq("id", params.lessonId);
  if (error) return new Response(error.message, { status: 500 });
  return new Response("OK");
}
