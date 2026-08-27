import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EfficacyNav } from "@/components/efficacy/nav";

export const dynamic = "force-dynamic";

export default async function EfficacyLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, is_ldm, full_name")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/learn");

  const navRole: "admin" | "ldm" | "teacher" =
    profile.role === "admin" ? "admin" : profile.is_ldm ? "ldm" : "teacher";

  return (
    <div className="min-h-screen bg-gray-50">
      <EfficacyNav role={navRole} userName={profile.full_name ?? undefined} />
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
