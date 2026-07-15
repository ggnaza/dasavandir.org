import type { SupabaseClient } from "@supabase/supabase-js";

export type TimetableAccess = {
  /** May edit the shared base agenda and set the moderator-adjustable tick. */
  canEditBase: boolean;
  /** Groups on this course that this user moderates. May be empty. */
  moderatedGroups: { id: string; name: string }[];
  /** May see the timetable at all (any of the above, or an enrolled learner). */
  canView: boolean;
};

/**
 * Who may do what to a course timetable (ADR-0005).
 *
 * Deliberately NOT assertCourseOwner: that grants full access to any
 * course_manager, whereas ADR-0005 narrowed base ownership to admin +
 * course_creator. A course_manager is read-only on the base UNLESS they moderate a
 * group, in which case they may override the ticked slots for that group only.
 * TLA 2026 has 9 managers but only 5 group moderators, so the distinction is real.
 *
 * Reads via the admin client on purpose: RLS on profiles recurses (OQ-003), so a
 * user-auth read of a role returns an error, not a role. See ADR-0002.
 */
export async function getTimetableAccess(
  admin: SupabaseClient,
  courseId: string,
  userId: string,
): Promise<TimetableAccess> {
  const [{ data: profile }, { data: course }, { data: groups }] = await Promise.all([
    admin.from("profiles").select("role").eq("id", userId).single(),
    admin.from("courses").select("created_by").eq("id", courseId).single(),
    admin.from("course_groups").select("id, name").eq("course_id", courseId).eq("moderator_id", userId),
  ]);

  const moderatedGroups = (groups ?? []) as { id: string; name: string }[];

  let canEditBase = profile?.role === "admin" || course?.created_by === userId;

  if (!canEditBase && profile?.role === "course_creator") {
    const { data } = await admin
      .from("course_creator_access")
      .select("course_id")
      .eq("creator_id", userId)
      .eq("course_id", courseId)
      .maybeSingle();
    canEditBase = !!data;
  }

  return {
    canEditBase,
    moderatedGroups,
    canView: canEditBase || moderatedGroups.length > 0,
  };
}
