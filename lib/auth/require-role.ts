import type { SupabaseClient } from "@supabase/supabase-js";

export const ADMIN_ROLES = ["admin"] as const;
// space_manager is a coarse "staff editor" like course_manager: it manages every
// course in its managed spaces (lib/org.getManagedSpaceIds). Callers that gate on
// EDITOR_ROLES and then touch a SPECIFIC course must still enforce the per-course
// scope via checkCourseAccess/assertCourseOwner (which already grants space_manager
// for courses whose space_id is in their managed set). EDITOR_ROLES is only a
// coarse pre-filter — it is not itself a per-course authorization.
export const EDITOR_ROLES = ["admin", "course_creator", "course_manager", "space_manager"] as const;
export const CREATOR_ROLES = ["admin", "course_creator"] as const;

/**
 * Fetch the caller's profile role and return a 403 Response if not in allowedRoles.
 * Returns null when the caller is authorized (proceed normally).
 *
 * Usage:
 *   const deny = await requireRole(admin, user.id, EDITOR_ROLES);
 *   if (deny) return deny;
 */
export async function requireRole(
  admin: SupabaseClient,
  userId: string,
  allowedRoles: readonly string[]
): Promise<Response | null> {
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (!profile || !allowedRoles.includes(profile.role)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  return null;
}
