import type { SupabaseClient } from "@supabase/supabase-js";

export type CourseReviewer = { id: string; name: string; role: string };

// People who can be assigned to review a course's submissions: the course's
// creators (original creator + course_creator_access) and its moderators
// (course_manager_access).
export async function getCourseReviewers(admin: SupabaseClient, courseId: string): Promise<CourseReviewer[]> {
  const [{ data: course }, { data: creatorAccess }, { data: managerAccess }] = await Promise.all([
    admin.from("courses").select("created_by").eq("id", courseId).maybeSingle(),
    admin.from("course_creator_access").select("creator_id").eq("course_id", courseId),
    admin.from("course_manager_access").select("manager_id").eq("course_id", courseId),
  ]);

  const ids = new Set<string>();
  if (course?.created_by) ids.add(course.created_by);
  (creatorAccess ?? []).forEach((r: any) => ids.add(r.creator_id));
  (managerAccess ?? []).forEach((r: any) => ids.add(r.manager_id));
  if (ids.size === 0) return [];

  const { data: profs } = await admin
    .from("profiles")
    .select("id, full_name, email, role")
    .in("id", Array.from(ids));

  return (profs ?? [])
    .map((p: any) => ({ id: p.id, name: p.full_name || p.email || "Unknown", role: p.role }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
