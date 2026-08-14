import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Given a set of enrolled user IDs, return the subset whose profile role is
 * `learner`. Moderators (`course_manager`), creators (`course_creator`) and
 * admins are excluded from learner-facing statistics: a learner who is later
 * promoted to moderator/creator must no longer count toward course-progress
 * numbers, even if an `enrollments` row still exists for them.
 *
 * This mirrors the global analytics page (`app/admin/analytics/page.tsx`),
 * which already builds its learner population from `role = 'learner'`.
 *
 * Returns a `Set` for cheap membership tests when filtering enrollment rows.
 */
export async function filterLearnerIds(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set<string>();

  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "learner")
    .in("id", userIds);

  return new Set((data ?? []).map((p) => p.id));
}
