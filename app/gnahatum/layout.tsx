import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GnahatumNav } from "@/components/gnahatum/nav";
import { getModuleGrants, allowedModules, canEnter } from "@/lib/access/module-access";
import { moduleForHost } from "@/lib/modules";

export const dynamic = "force-dynamic";

export default async function GnahatumLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // RLS on `profiles` requires the service-role client for a self-read.
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/learn");

  const grants = await getModuleGrants(user.id, profile.role);
  if (!canEnter(grants, "gnahatum")) redirect("/learn");

  const host = headers().get("host") ?? "";
  const onSubdomain = moduleForHost(host)?.id === "gnahatum";

  return (
    <div className="min-h-screen bg-gray-50">
      <GnahatumNav
        userName={profile.full_name ?? undefined}
        modules={allowedModules(grants)}
        isLdm={grants.gnahatum === "ldm"}
        isAdmin={profile.role === "admin"}
        onSubdomain={onSubdomain}
      />
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
