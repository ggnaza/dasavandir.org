import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { z } from "zod";

const EDITOR_ROLES = ["admin", "course_creator", "course_manager"];

const schema = z.object({
  lesson_id: z.string().uuid(),
  file_name: z.string().min(1).max(255),
});

// POST /api/files/upload-url — issue a signed upload URL for a lesson attachment.
//
// Why a signed URL instead of a direct browser upload: the `lesson-files`
// storage bucket has no staff INSERT policy on storage.objects (unlike
// `course-covers` / `lesson-documents`), so a browser client upload is rejected
// by RLS ("The database schema is invalid or incompatible"). The signed URL is
// minted here with the service-role client, so the upload is authorized by the
// one-time token rather than storage RLS — no manual SQL migration required, and
// the file still streams client → storage directly (avoiding serverless body limits).
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!EDITOR_ROLES.includes(profile?.role ?? "")) return new Response("Forbidden", { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const { lesson_id, file_name } = parsed.data;

  const { data: lesson } = await admin.from("lessons").select("course_id").eq("id", lesson_id).single();
  if (!lesson) return new Response("Lesson not found", { status: 404 });

  const ownerErr = await assertCourseOwner(lesson.course_id, user.id);
  if (ownerErr) return ownerErr;

  const safeName = file_name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${lesson_id}/${Date.now()}-${safeName}`;

  const { data, error } = await admin.storage
    .from("lesson-files")
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error("[files/upload-url]", error);
    return new Response(`Failed to create upload URL: ${error?.message ?? "unknown error"}`, { status: 500 });
  }

  return Response.json({ path: data.path, token: data.token });
}
