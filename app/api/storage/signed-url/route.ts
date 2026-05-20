import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCourseOwner } from "@/lib/assert-course-owner";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STAFF_ROLES = ["admin", "course_creator", "course_manager"];

export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path");
  if (!path) return new Response("Missing path", { status: 400 });

  // Path format: {lessonId}/{timestamp}-{filename} — extract lessonId to verify access
  const lessonId = path.split("/")[0];
  if (!UUID_RE.test(lessonId)) return new Response("Invalid path", { status: 400 });

  const admin = createAdminClient();

  const { data: lesson } = await admin
    .from("lessons")
    .select("course_id")
    .eq("id", lessonId)
    .single();

  if (!lesson) return new Response("Not found", { status: 404 });

  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();

  if (STAFF_ROLES.includes(profile?.role ?? "")) {
    const ownerError = await assertCourseOwner(lesson.course_id, user.id);
    if (ownerError) return ownerError;
  } else {
    const { data: enrollment } = await admin
      .from("enrollments")
      .select("id")
      .eq("user_id", user.id)
      .eq("course_id", lesson.course_id)
      .maybeSingle();
    if (!enrollment) return new Response("Forbidden", { status: 403 });
  }

  const { data, error } = await admin.storage
    .from("lesson-files")
    .createSignedUrl(path, 3600);

  if (error || !data?.signedUrl) {
    return new Response("Failed to generate URL", { status: 500 });
  }

  return Response.json({ url: data.signedUrl });
}
