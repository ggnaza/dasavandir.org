import { redirect } from "next/navigation";
import "katex/dist/katex.min.css";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { allowedModules, canEnter, getModuleGrants } from "@/lib/access/module-access";
import { AttestationNav } from "@/components/attestation/nav";

export const dynamic = "force-dynamic";

export default async function AttestationLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/attestation");

  // RLS on `profiles` requires the service-role client for a self-read (CLAUDE.md).
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (!profile) redirect("/learn");

  const grants = await getModuleGrants(user.id, profile.role);
  if (!canEnter(grants, "attestation")) redirect("/learn");

  return (
    <div className="min-h-screen bg-gray-50">
      <AttestationNav
        userName={profile.full_name ?? undefined}
        modules={allowedModules(grants)}
        isAdmin={profile.role === "admin"}
        isManager={profile.role === "admin" || grants.attestation === "ldm"}
      />
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
