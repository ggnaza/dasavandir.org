import type { SupabaseClient } from "@supabase/supabase-js";
import { getManagedSpaceCourseIds } from "@/lib/org";

/**
 * Can this staff member act on this learner (message them, edit their profile)?
 *
 * The rule mirrors course-level authorization — staff may only reach learners
 * they actually share a course/cohort with, never every learner in the system:
 *
 *   - admin          → any learner
 *   - space_manager  → learners enrolled in any course in a space they manage
 *   - course_manager → learners assigned to them in moderator_cohort_assignments
 *   - course_creator → learners enrolled in a course the creator owns/is linked to
 *   - anyone else    → no access
 *
 * Requires the admin (service-role) client. Returns a boolean; callers turn a
 * false into their own 403.
 */
export async function staffCanAccessLearner(
  admin: SupabaseClient,
  staffId: string,
  role: string,
  learnerId: string,
): Promise<boolean> {
  if (role === "admin") return true;

  if (role === "space_manager") {
    // Learners the space manager oversees = anyone enrolled in a course whose
    // space_id is in their managed set (getManagedSpaceCourseIds already resolves
    // spaces → courses). No cross-space reach.
    const courseIds = await getManagedSpaceCourseIds(admin, staffId);
    if (courseIds.length === 0) return false;
    const { data: enrollment } = await admin
      .from("enrollments")
      .select("id")
      .eq("user_id", learnerId)
      .in("course_id", courseIds)
      .limit(1)
      .maybeSingle();
    return !!enrollment;
  }

  if (role === "course_manager") {
    const { data } = await admin
      .from("moderator_cohort_assignments")
      .select("id")
      .eq("moderator_id", staffId)
      .eq("learner_id", learnerId)
      .maybeSingle();
    return !!data;
  }

  if (role === "course_creator") {
    // Courses this creator owns outright or is explicitly linked to.
    const [{ data: owned }, { data: linked }] = await Promise.all([
      admin.from("courses").select("id").eq("created_by", staffId),
      admin.from("course_creator_access").select("course_id").eq("creator_id", staffId),
    ]);
    const courseIds = [
      ...(owned ?? []).map((c) => c.id),
      ...(linked ?? []).map((l) => l.course_id),
    ];
    if (courseIds.length === 0) return false;

    // Does the learner have an enrollment in any of those courses?
    const { data: enrollment } = await admin
      .from("enrollments")
      .select("id")
      .eq("user_id", learnerId)
      .in("course_id", courseIds)
      .limit(1)
      .maybeSingle();
    return !!enrollment;
  }

  return false;
}
