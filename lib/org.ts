import type { SupabaseClient } from "@supabase/supabase-js";

// Multi-tenancy Phase 0/1 is single-tenant: the current organization is always AEI.
// Hostname-based tenant resolution is Phase 2 (deferred — ADR-0004). These helpers are the ONE
// seam to replace when Phase 2 lands, so call sites never hardcode the slug themselves.
export const CURRENT_ORG_SLUG = "aei";

/** The current tenant's organization id. Returns null only if Phase 0a was never applied. */
export async function getCurrentOrgId(admin: SupabaseClient): Promise<string | null> {
  const { data } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", CURRENT_ORG_SLUG)
    .single();
  return data?.id ?? null;
}

/** The org's default/general space (lowest ord) — the audience new users join by default. */
export async function getDefaultSpaceId(admin: SupabaseClient, orgId: string): Promise<string | null> {
  const { data } = await admin
    .from("spaces")
    .select("id")
    .eq("org_id", orgId)
    .order("ord")
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Best-effort: make the user a member of the current org and its default space, so a new signup can
 * browse the general catalog. Idempotent (ignoreDuplicates); never throws — logs and moves on, like
 * ensureProfile. Special spaces (HR / Recruitment) are assigned separately by an admin.
 */
export async function ensureOrgMembership(
  admin: SupabaseClient,
  userId: string,
  role = "learner"
): Promise<void> {
  const orgId = await getCurrentOrgId(admin);
  if (!orgId) return;

  const { error: oErr } = await admin
    .from("org_members")
    .upsert({ org_id: orgId, user_id: userId, role }, { onConflict: "org_id,user_id", ignoreDuplicates: true });
  if (oErr) console.error("[ensureOrgMembership] org_members upsert failed", { userId, error: oErr.message });

  const defaultSpaceId = await getDefaultSpaceId(admin, orgId);
  if (defaultSpaceId) {
    const { error: sErr } = await admin
      .from("space_members")
      .upsert(
        { space_id: defaultSpaceId, user_id: userId, role },
        { onConflict: "space_id,user_id", ignoreDuplicates: true }
      );
    if (sErr) console.error("[ensureOrgMembership] space_members upsert failed", { userId, error: sErr.message });
  }
}

/** The space ids a user is a MANAGER of (via space_manager_access) — "admin of these spaces". */
export async function getManagedSpaceIds(admin: SupabaseClient, userId: string): Promise<string[]> {
  const { data } = await admin.from("space_manager_access").select("space_id").eq("manager_id", userId);
  return (data ?? []).map((r) => (r as { space_id: string }).space_id);
}

/** The course ids in the spaces a user manages — the scope for a space_manager's global dashboards. */
export async function getManagedSpaceCourseIds(admin: SupabaseClient, userId: string): Promise<string[]> {
  const spaceIds = await getManagedSpaceIds(admin, userId);
  if (spaceIds.length === 0) return [];
  const { data } = await admin.from("courses").select("id").in("space_id", spaceIds);
  return (data ?? []).map((r) => (r as { id: string }).id);
}

/**
 * Add a user to the space that owns a course — called when they enrol, so an invited learner lands in
 * that course's audience (e.g. HR Onboarding). Best-effort, idempotent, never throws.
 */
export async function addUserToCourseSpace(
  admin: SupabaseClient,
  userId: string,
  courseId: string
): Promise<void> {
  const { data: course } = await admin.from("courses").select("space_id").eq("id", courseId).maybeSingle();
  const spaceId = (course as { space_id: string | null } | null)?.space_id;
  if (!spaceId) return;

  const { error } = await admin
    .from("space_members")
    .upsert(
      { space_id: spaceId, user_id: userId, role: "learner" },
      { onConflict: "space_id,user_id", ignoreDuplicates: true }
    );
  if (error) console.error("[addUserToCourseSpace] failed", { userId, courseId, error: error.message });
}
