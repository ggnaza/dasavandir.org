import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Returns the learner IDs a course_manager (moderator) is responsible for in a
 * course — i.e. the members of the groups they moderate. Also unions in any rows
 * from the legacy `moderator_cohort_assignments` table for backward compatibility.
 *
 * Returns null if the user is not a course_manager (caller should show all learners).
 * Returns a (possibly empty) array for a course_manager — empty means they moderate
 * no group members yet, so they should see no learners.
 */
export async function getModeratorCohort(
  userId: string,
  courseId: string,
  role: string
): Promise<string[] | null> {
  if (role !== "course_manager") return null;

  const admin = createAdminClient();

  const [{ data: groups }, { data: assignments }] = await Promise.all([
    admin.from("course_groups").select("id").eq("course_id", courseId).eq("moderator_id", userId),
    admin
      .from("moderator_cohort_assignments")
      .select("learner_id")
      .eq("moderator_id", userId)
      .eq("course_id", courseId),
  ]);

  const groupIds = (groups ?? []).map((g) => g.id);
  const { data: members } = groupIds.length
    ? await admin.from("course_group_members").select("user_id").in("group_id", groupIds)
    : { data: [] as { user_id: string }[] };

  const ids = new Set<string>();
  (members ?? []).forEach((m: any) => ids.add(m.user_id));
  (assignments ?? []).forEach((a: any) => ids.add(a.learner_id));
  return Array.from(ids);
}
