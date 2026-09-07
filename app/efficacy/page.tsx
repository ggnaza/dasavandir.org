import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getModuleGrants } from "@/lib/access/module-access";

export const dynamic = "force-dynamic";

export default async function EfficacyPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/learn");

  const grants = await getModuleGrants(user.id, profile.role);

  if (profile.role === "admin") redirect("/efficacy/admin");
  if (grants.efficacy === "ldm") redirect("/efficacy/ldm");
  redirect("/efficacy/teacher");
}
