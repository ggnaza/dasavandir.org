import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Returns the learner IDs assigned to a course_manager for a course.
 * Returns null if the user is not a course_manager (caller should show all learners).
 * Returns an empty array if they are a course_manager with no assignments yet.
 */
export async function getModeratorCohort(
  userId: string,
  courseId: string,
  role: string
): Promise<string[] | null> {
  if (role !== "course_manager") return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("moderator_cohort_assignments")
    .select("learner_id")
    .eq("moderator_id", userId)
    .eq("course_id", courseId);

  return (data ?? []).map((r) => r.learner_id);
}
