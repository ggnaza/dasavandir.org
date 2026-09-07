import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Gnahatum teachers are the platform learners on the school's own email domain.
 *
 * They are ordinary `learner` profiles that already exist in the database —
 * there is no separate teacher record and nothing to create at import time.
 *
 * This used to be expressed as `modules @> {gnahatum}`, which silently matched
 * nobody (the column defaults to `{courses}`), so the teacher dropdown rendered
 * empty and then hid itself. Keep the rule here so the page and the API cannot
 * drift apart again.
 */
export const TEACHER_EMAIL_DOMAIN = "@dasavandir.org";

export interface GnahatumTeacher {
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
export async function listGnahatumTeachers(
  admin: SupabaseClient,
  excludeUserId?: string,
): Promise<GnahatumTeacher[]> {
  // Preferred source: everyone explicitly granted Gnahatum as a member.
  const { data: granted, error: grantError } = await admin
    .from("module_access")
    .select("user_id")
    .eq("module", "gnahatum")
    .eq("access", "member")
    .limit(500);

  if (grantError) {
    console.error("[listGnahatumTeachers] module_access query failed", grantError.message);
  }

  const grantedIds = (granted ?? [])
    .map((r: { user_id: string }) => r.user_id)
    .filter((id: string) => id !== excludeUserId);

  if (grantedIds.length > 0) {
    const { data, error } = await admin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", grantedIds)
      .eq("status", "active")
      .order("full_name");
    if (error) {
      console.error("[listGnahatumTeachers] profiles query failed", error.message);
      return [];
    }
    return data ?? [];
  }

  // Fallback: nobody has been granted yet. Rather than render an empty picker
  // (the original bug this file documents), fall back to the school domain.
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
    console.error("[listGnahatumTeachers] query failed", error.message);
    return [];
  }
  return data ?? [];
}
