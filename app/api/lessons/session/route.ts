import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STAFF_ROLES = ["admin", "course_creator", "course_manager"];

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  let body: { lessonId?: string; userId?: string; duration?: number };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const { lessonId, duration } = body;
  if (!lessonId || !UUID_RE.test(lessonId) || typeof duration !== "number" || duration < 5 || duration > 86400) {
    return new Response("Invalid payload", { status: 400 });
  }

  const admin = createAdminClient();

  // Verify the user has access to this lesson (enrolled or staff)
  const { data: lesson } = await admin
    .from("lessons")
    .select("course_id")
    .eq("id", lessonId)
    .single();

  if (!lesson) return new Response("Not found", { status: 404 });

  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();

  if (!STAFF_ROLES.includes(profile?.role ?? "")) {
    const { data: enrollment } = await admin
      .from("enrollments")
      .select("id")
      .eq("user_id", user.id)
      .eq("course_id", lesson.course_id)
      .maybeSingle();
    if (!enrollment) return new Response("Forbidden", { status: 403 });
  }

  await admin.from("lesson_sessions").insert({
    user_id: user.id,
    lesson_id: lessonId,
    duration_seconds: duration,
  });

  return new Response("ok");
}
