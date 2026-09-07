/**
 * Per-module access, server side.
 *
 * Before this existed, "who can use what" was spread over three different
 * mechanisms: a `profiles.modules` text[] (Gnahatum + Courses), a global
 * `profiles.is_ldm` boolean (Efficacy only), and an implicit rule that any
 * course_manager/space_manager was an LDM in Gnahatum. That made a grant like
 * "LDM in Efficacy but not in Gnahatum" impossible to express.
 *
 * `public.module_access(user_id, module, access)` replaces all three. One row
 * per module a user may enter; `access` says whether they are a member
 * (teacher/learner) or an LDM (the leading/observing role) in that module.
 *
 * RLS is enabled on the table, so every read here goes through the service-role
 * admin client — the same rule as reading `profiles`, per CLAUDE.md.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  MODULE_IDS,
  noAccess,
  type AccessLevel,
  type ModuleId,
} from "@/lib/modules";

export type ModuleGrants = Record<ModuleId, AccessLevel>;

/** Platform admins are implicitly LDM everywhere; nothing is granted per-row. */
function adminGrants(): ModuleGrants {
  return { courses: "ldm", efficacy: "ldm", gnahatum: "ldm" };
}

/**
 * Every module grant for one user.
 *
 * Pass `role` when the caller already read it, to avoid a second profiles read.
 * When omitted it is fetched, because an admin must never be locked out by a
 * missing grant row.
 */
export async function getModuleGrants(
  userId: string,
  role?: string | null,
): Promise<ModuleGrants> {
  const admin = createAdminClient();

  let effectiveRole = role;
  if (effectiveRole === undefined) {
    const { data } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();
    effectiveRole = data?.role ?? null;
  }
  if (effectiveRole === "admin") return adminGrants();

  const { data, error } = await admin
    .from("module_access")
    .select("module, access")
    .eq("user_id", userId);

  // Migrations here are applied by hand in the Supabase SQL editor, so the
  // deploy can land before `module_access` exists. Denying everything in that
  // window would lock every non-admin out of every module at once, which is
  // exactly the class of auth outage CLAUDE.md exists to prevent. Fall back to
  // the pre-migration columns until the table is there.
  if (error?.code === "42P01") return legacyGrants(admin, userId, effectiveRole);

  const grants = noAccess();
  if (error || !data) return grants;

  for (const row of data as { module: string; access: string }[]) {
    if ((MODULE_IDS as string[]).includes(row.module)) {
      grants[row.module as ModuleId] =
        row.access === "ldm" ? "ldm" : "member";
    }
  }
  return grants;
}

/**
 * The access rules as they stood before `module_access`: a `profiles.modules`
 * array, the `is_ldm` tick for Efficacy, and course_manager/space_manager
 * implying an LDM in Gnahatum (then "ararka"). Only reached when the table is
 * missing; delete it once the migration is applied everywhere.
 */
async function legacyGrants(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  userId: string,
  role: string | null | undefined,
): Promise<ModuleGrants> {
  const grants = noAccess();

  // `is_ldm` only exists where efficacy_schema.sql has been applied. Selecting
  // a missing column fails the whole row read, which would silently strip the
  // user's module list too — so ask for it separately and tolerate its absence.
  const { data } = await admin
    .from("profiles")
    .select("modules")
    .eq("id", userId)
    .single();
  const { data: ldmRow } = await admin
    .from("profiles")
    .select("is_ldm")
    .eq("id", userId)
    .single();

  const legacyModules: string[] = data?.modules ?? ["courses"];
  for (const m of legacyModules) {
    const id = m === "ararka" ? "gnahatum" : m;
    if ((MODULE_IDS as string[]).includes(id)) grants[id as ModuleId] = "member";
  }
  if (ldmRow?.is_ldm) grants.efficacy = "ldm";
  if (role === "course_manager" || role === "space_manager") grants.gnahatum = "ldm";
  return grants;
}

/** Replace a user's grants wholesale. `none` entries delete the row. */
export async function setModuleGrants(
  userId: string,
  grants: Partial<ModuleGrants>,
): Promise<{ error?: string }> {
  const admin = createAdminClient();

  const upserts: { user_id: string; module: string; access: string }[] = [];
  const removals: string[] = [];

  for (const id of MODULE_IDS) {
    const level = grants[id];
    if (level === undefined) continue;
    if (level === "none") removals.push(id);
    else upserts.push({ user_id: userId, module: id, access: level });
  }

  if (removals.length) {
    const { error } = await admin
      .from("module_access")
      .delete()
      .eq("user_id", userId)
      .in("module", removals);
    if (error) return { error: error.message };
  }

  if (upserts.length) {
    const { error } = await admin
      .from("module_access")
      .upsert(upserts, { onConflict: "user_id,module" });
    if (error) return { error: error.message };
  }

  return {};
}

export function canEnter(grants: ModuleGrants, id: ModuleId): boolean {
  return grants[id] !== "none";
}

export function isLdmIn(grants: ModuleGrants, id: ModuleId): boolean {
  return grants[id] === "ldm";
}

/** Module ids the user may enter — the list the nav switcher renders. */
export function allowedModules(grants: ModuleGrants): ModuleId[] {
  return MODULE_IDS.filter((id) => grants[id] !== "none");
}
