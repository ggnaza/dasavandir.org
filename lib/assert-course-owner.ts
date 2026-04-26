import { createAdminClient } from "@/lib/supabase/admin";

export async function assertCourseOwner(courseId: string, userId: string): Promise<Response | null> {
  const admin = createAdminClient();
  const { data: course } = await admin
    .from("courses")
    .select("created_by")
    .eq("id", courseId)
    .single();

  if (!course) return new Response("Course not found", { status: 404 });
  if (course.created_by !== userId) return new Response("Forbidden", { status: 403 });
  return null;
}
