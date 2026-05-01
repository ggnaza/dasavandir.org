import { createAdminClient } from "@/lib/supabase/admin";

export async function assertCourseOwner(courseId: string, userId: string): Promise<Response | null> {
  const admin = createAdminClient();

  const [{ data: profile }, { data: course }] = await Promise.all([
    admin.from("profiles").select("role").eq("id", userId).single(),
    admin.from("courses").select("created_by").eq("id", courseId).single(),
  ]);

  if (!course) return new Response("Course not found", { status: 404 });

  // Super admins have access to all courses
  if (profile?.role === "admin") return null;

  // Original course creator always has access
  if (course.created_by === userId) return null;

  // Check if granted explicit access
  const { data: access } = await admin
    .from("course_creator_access")
    .select("id")
    .eq("creator_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (access) return null;

  return new Response("Forbidden", { status: 403 });
}
