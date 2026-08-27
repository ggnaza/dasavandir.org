import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface EfficacyUser {
  id: string;
  email: string;
  role: string;
  isLdm: boolean;
  fullName: string | null;
}

export async function getEfficacyUser(): Promise<EfficacyUser | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, is_ldm, full_name")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return {
    id: user.id,
    email: user.email ?? "",
    role: profile.role,
    isLdm: profile.is_ldm,
    fullName: profile.full_name,
  };
}

export function requireAuth(user: EfficacyUser | null): Response | null {
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return null;
}

export function requireLdm(user: EfficacyUser): Response | null {
  if (!user.isLdm && user.role !== "admin")
    return Response.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

export function requireAdmin(user: EfficacyUser): Response | null {
  if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
  return null;
}
