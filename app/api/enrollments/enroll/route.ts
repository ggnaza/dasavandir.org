import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { allowed } = await checkRateLimit(`enroll:${user.id}`, 20, 60 * 60_000);
  if (!allowed) return rateLimitResponse({ limit: 20, windowSecs: 3600 });

  const { courseId } = await req.json();
  if (!courseId) return new Response("Missing courseId", { status: 400 });

  const admin = createAdminClient();

  // Verify course exists and is published
  const { data: course } = await admin
    .from("courses")
    .select("id")
    .eq("id", courseId)
    .eq("published", true)
    .single();

  if (!course) return new Response("Course not found", { status: 404 });

  // Upsert enrollment (safe to call multiple times)
  await admin
    .from("enrollments")
    .upsert({ user_id: user.id, course_id: courseId }, { onConflict: "user_id,course_id" });

  return Response.json({ enrolled: true });
}
