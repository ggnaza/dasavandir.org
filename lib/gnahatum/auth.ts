import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getModuleGrants } from "@/lib/access/module-access";

export interface GnahatumUser {
  id: string;
  email: string;
  role: string;
  /** LDM *in Gnahatum* — from module_access, not from the platform role. */
  isLdm: boolean;
  fullName: string | null;
}

/**
 * The signed-in user, or null when they are not signed in or have no Gnahatum
 * grant. Returning null for an ungranted user means every API route that calls
 * `requireAuth` also enforces module access, without repeating the check.
 */
export async function getGnahatumUser(): Promise<GnahatumUser | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // RLS on `profiles` requires the service-role client for a self-read.
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  const grants = await getModuleGrants(user.id, profile.role);
  if (grants.gnahatum === "none") return null;

  return {
    id: user.id,
    email: user.email ?? "",
    role: profile.role,
    isLdm: grants.gnahatum === "ldm",
    fullName: profile.full_name,
  };
}

export function requireAuth(user: GnahatumUser | null): Response | null {
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return null;
}

export function requireLdm(user: GnahatumUser): Response | null {
  if (!user.isLdm && user.role !== "admin")
    return Response.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

export function requireAdmin(user: GnahatumUser): Response | null {
  if (user.role !== "admin")
    return Response.json({ error: "Forbidden" }, { status: 403 });
  return null;
}
