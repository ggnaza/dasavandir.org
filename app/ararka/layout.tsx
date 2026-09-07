import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ArarkaNav } from "@/components/ararka/nav";

export const dynamic = "force-dynamic";

export default async function ArarkaLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, full_name, modules")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/learn");

  const userModules: string[] = profile.modules ?? ["courses"];
  const isAdmin = profile.role === "admin";

  if (!isAdmin && !userModules.includes("ararka")) {
    redirect("/learn");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ArarkaNav userName={profile.full_name ?? undefined} modules={userModules} isAdmin={isAdmin} />
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
