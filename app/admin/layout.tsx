import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Nav } from "@/components/nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  const allowedRoles = ["admin", "course_creator", "course_manager"];
  if (!allowedRoles.includes(profile?.role ?? "")) redirect("/learn");

  const navRole =
    profile?.role === "admin" ? "admin"
    : profile?.role === "course_manager" ? "moderator"
    : "creator";

  return (
    <div className="min-h-screen">
      <Nav role={navRole} userName={profile?.full_name} />
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
