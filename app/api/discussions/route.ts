import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { courseId, lessonId, title, body } = await req.json();
  if (!courseId || !title?.trim() || !body?.trim())
    return new Response("Missing fields", { status: 400 });

  const admin = createAdminClient();

  // Verify enrollment or admin
  const [{ data: enrollment }, { data: profile }] = await Promise.all([
    admin.from("enrollments").select("id").eq("user_id", user.id).eq("course_id", courseId).single(),
    admin.from("profiles").select("role").eq("id", user.id).single(),
  ]);

  if (!enrollment && profile?.role !== "admin")
    return new Response("Not enrolled", { status: 403 });

  const { data, error } = await admin.from("discussions").insert({
    course_id: courseId,
    lesson_id: lessonId ?? null,
    user_id: user.id,
    title: title.trim(),
    body: body.trim(),
  }).select().single();

  if (error) return new Response(error.message, { status: 500 });
  return Response.json(data);
}
