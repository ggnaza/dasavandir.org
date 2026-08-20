import type { SupabaseClient } from "@supabase/supabase-js";

// Multi-tenancy Phase 0/1 is single-tenant: the current organization is always AEI.
// Hostname-based tenant resolution is Phase 2 (deferred — ADR-0004). This helper is the ONE
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
