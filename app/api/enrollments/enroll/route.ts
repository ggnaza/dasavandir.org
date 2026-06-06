import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureProfile } from "@/lib/auth/ensure-profile";
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

  // Verify course exists, is published, and is publicly enrollable
  const { data: course, error: courseErr } = await admin
    .from("courses")
    .select("id, access_type, course_type")
    .eq("id", courseId)
    .eq("published", true)
    .single();

  if (courseErr || !course) return new Response("Course not found", { status: 404 });

  // Private and internal courses can only be enrolled via admin invitation — not self-service
  if (course.access_type === "private" || course.course_type === "internal") {
    return new Response("This course requires an invitation to enroll.", { status: 403 });
  }

  // Defensive: ensure the user's profile exists (see lib/auth/ensure-profile.ts and CLAUDE.md).
  // Legacy users may be missing a profile row, which would FK-violate the enrollment insert.
  await ensureProfile(admin, user);

  // Upsert enrollment (safe to call multiple times)
  const { error: enrollErr } = await admin
    .from("enrollments")
    .upsert({ user_id: user.id, course_id: courseId }, { onConflict: "user_id,course_id" });

  if (enrollErr) {
    console.error("[enrollments/enroll]", enrollErr);
    return new Response(
      JSON.stringify({ error: enrollErr.message || "Failed to enroll" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  return Response.json({ enrolled: true });
}
