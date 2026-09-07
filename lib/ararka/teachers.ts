import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Ararka teachers are the platform learners on the school's own email domain.
 *
 * They are ordinary `learner` profiles that already exist in the database —
 * there is no separate teacher record and nothing to create at import time.
 *
 * This used to be expressed as `modules @> {ararka}`, which silently matched
 * nobody (the column defaults to `{courses}`), so the teacher dropdown rendered
 * empty and then hid itself. Keep the rule here so the page and the API cannot
 * drift apart again.
 */
export const TEACHER_EMAIL_DOMAIN = "@dasavandir.org";

export interface ArarkaTeacher {
  id: string;
  full_name: string | null;
  email: string;
}

/**
 * List the teachers an LDM/admin may upload on behalf of.
 *
 * `excludeUserId` drops the caller from their own list — an LDM on the school
 * domain would otherwise appear as one of their own teachers.
 */
export async function listArarkaTeachers(
  admin: SupabaseClient,
  excludeUserId?: string,
): Promise<ArarkaTeacher[]> {
  let query = admin
    .from("profiles")
    .select("id, full_name, email")
    .ilike("email", `%${TEACHER_EMAIL_DOMAIN}`)
    .eq("status", "active")
    .order("full_name")
    .limit(500);

  if (excludeUserId) query = query.neq("id", excludeUserId);

  const { data, error } = await query;
  if (error) {
    console.error("[listArarkaTeachers] query failed", error.message);
    return [];
  }
  return data ?? [];
}
