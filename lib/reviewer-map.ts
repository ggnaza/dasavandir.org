import type { SupabaseClient } from "@supabase/supabase-js";

// A learner's "reviewer" for a course is the moderator of the group they belong
// to in that course (course_groups.moderator_id → course_group_members).
// Returns a map keyed by `${userId}:${courseId}` → moderatorId.
export async function buildReviewerMap(
  admin: SupabaseClient,
  courseIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (courseIds.length === 0) return map;

  const { data: groups } = await admin
    .from("course_groups")
    .select("id, course_id, moderator_id")
    .in("course_id", courseIds);
  const groupList = groups ?? [];
  const groupIds = groupList.map((g) => g.id);
  if (groupIds.length === 0) return map;

  const { data: members } = await admin
    .from("course_group_members")
    .select("group_id, user_id")
    .in("group_id", groupIds);

  const groupById = Object.fromEntries(groupList.map((g) => [g.id, g]));
  for (const m of members ?? []) {
    const g = groupById[m.group_id];
    if (g?.moderator_id) map.set(`${m.user_id}:${g.course_id}`, g.moderator_id);
  }
  return map;
}
