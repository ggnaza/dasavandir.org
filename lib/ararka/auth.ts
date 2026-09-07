import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ArarkaUser {
  id: string;
  email: string;
  role: string;
  fullName: string | null;
}

export async function getArarkaUser(): Promise<ArarkaUser | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return {
    id: user.id,
    email: user.email ?? "",
    role: profile.role,
    fullName: profile.full_name,
  };
}

export function requireAuth(user: ArarkaUser | null): Response | null {
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return null;
}

export function requireAdmin(user: ArarkaUser): Response | null {
  if (user.role !== "admin")
    return Response.json({ error: "Forbidden" }, { status: 403 });
  return null;
}
