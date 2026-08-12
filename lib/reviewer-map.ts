import type { SupabaseClient } from "@supabase/supabase-js";

// A learner's "reviewer" for an assignment is the moderator of the group they belong
// to in that course *for the assignment's phase* (course_groups.moderator_id →
// course_group_members, scoped by course_groups.phase_id). See ADR-0003.
//
// The returned map is keyed `${userId}:${courseId}:${phaseKey}` where phaseKey is the
// group's `phase_id` or the literal "none" for an untagged (course-wide) group. A
// wildcard key `${userId}:${courseId}:*` holds the first moderator seen for that
// learner+course, as a best-effort fallback for shared (untagged) assignments in a
// phased course. Resolve with `resolveReviewer` rather than reading the map directly.
export async function buildReviewerMap(
  admin: SupabaseClient,
  courseIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (courseIds.length === 0) return map;

  const { data: groups } = await admin
    .from("course_groups")
    .select("id, course_id, moderator_id, phase_id")
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
    if (!g?.moderator_id) continue;
    const phaseKey = (g.phase_id as string | null) ?? "none";
    map.set(`${m.user_id}:${g.course_id}:${phaseKey}`, g.moderator_id);
    const wildcard = `${m.user_id}:${g.course_id}:*`;
    if (!map.has(wildcard)) map.set(wildcard, g.moderator_id);
  }
  return map;
}

// Resolve the moderator who should review a submission, given its learner, course and
// the assignment lesson's phase. Tries the exact phase first; for a phased assignment
// with no matching group, falls back to the learner's untagged group, then to any of
// the learner's groups in the course (best-effort — the notification is non-critical).
export function resolveReviewer(
  map: Map<string, string>,
  userId: string,
  courseId: string,
  phaseId: string | null
): string | undefined {
  const phaseKey = phaseId ?? "none";
  return (
    map.get(`${userId}:${courseId}:${phaseKey}`) ??
    (phaseId ? map.get(`${userId}:${courseId}:none`) : undefined) ??
    map.get(`${userId}:${courseId}:*`)
  );
}
