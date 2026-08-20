import type { SupabaseClient } from "@supabase/supabase-js";
import { addUserToCourseSpace } from "@/lib/org";

/**
 * Enrol a user in a course (idempotent) and place them in the course's space.
 * Shared by the free-enrol route and by payment success, so both paths behave identically.
 * Assumes the caller has already ensured the profile exists (ensureProfile) and authorised the enrol
 * (free self-enrol gate, or a paid order marked `paid`).
 */
export async function enrollUserInCourse(
  admin: SupabaseClient,
  userId: string,
  courseId: string
): Promise<{ error?: string }> {
  const { error } = await admin
    .from("enrollments")
    .upsert({ user_id: userId, course_id: courseId }, { onConflict: "user_id,course_id" });
  if (error) return { error: error.message };
  await addUserToCourseSpace(admin, userId, courseId);
  return {};
}
