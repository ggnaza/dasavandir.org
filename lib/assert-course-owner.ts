import { createAdminClient } from "@/lib/supabase/admin";
import { getManagedSpaceIds } from "@/lib/org";

export type CourseAccess = "ok" | "not_found" | "forbidden";

/**
 * Core course-access check shared by the API guard (assertCourseOwner) and the
 * page guard (assertCoursePageAccess). Returns a plain discriminant so each
 * caller can turn it into the right control flow — a Response for API routes,
 * a redirect/notFound for Server Component pages.
 *
 * Access is granted to: super admins, the original course creator, anyone in
 * course_creator_access, and course_managers in course_manager_access.
 */
export async function checkCourseAccess(courseId: string, userId: string): Promise<CourseAccess> {
  const admin = createAdminClient();

  const [{ data: profile }, { data: course }] = await Promise.all([
    admin.from("profiles").select("role").eq("id", userId).single(),
    admin.from("courses").select("created_by, space_id").eq("id", courseId).single(),
  ]);

  if (!course) return "not_found";

  // Super admins have access to all courses
  if (profile?.role === "admin") return "ok";

  // Original course creator always has access
  if (course.created_by === userId) return "ok";

  // Check course_creator_access (for course_creator role)
  const { data: creatorAccess } = await admin
    .from("course_creator_access")
    .select("id")
    .eq("creator_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (creatorAccess) return "ok";

  // Check course_manager_access (for course_manager role)
  if (profile?.role === "course_manager") {
    const { data: managerAccess } = await admin
      .from("course_manager_access")
      .select("id")
      .eq("manager_id", userId)
      .eq("course_id", courseId)
      .maybeSingle();

    if (managerAccess) return "ok";
  }

  // Space managers have access to every course in a space they manage.
  if (profile?.role === "space_manager" && course.space_id) {
    const managedSpaceIds = await getManagedSpaceIds(admin, userId);
    if (managedSpaceIds.includes(course.space_id)) return "ok";
  }

  return "forbidden";
}

/**
 * API-route guard. Returns a Response to short-circuit the handler, or null if
 * access is allowed. Do NOT use this in a Server Component page — returning a
 * Response from a page crashes the render. Use assertCoursePageAccess instead.
 */
export async function assertCourseOwner(courseId: string, userId: string): Promise<Response | null> {
  const access = await checkCourseAccess(courseId, userId);
  if (access === "not_found") return new Response("Course not found", { status: 404 });
  if (access === "forbidden") return new Response("Forbidden", { status: 403 });
  return null;
}
