import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Nav } from "@/components/nav";
import { cookies } from "next/headers";
import { getLang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function LearnLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const admin = createAdminClient();
  const [{ data: profile }, { count: unreadCount }] = await Promise.all([
    supabase.from("profiles").select("role, full_name, status").eq("id", user.id).single(),
    admin.from("notifications").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("read", false),
  ]);

  const lang = getLang(cookies().get("lang")?.value);
  const navRole = profile?.role === "course_creator" ? "creator" : "learner";
  const isPending = profile?.status === "pending";

  return (
    <div className="min-h-screen">
      <Nav role={navRole as "learner" | "admin" | "creator"} userName={profile?.full_name} unreadNotifications={unreadCount ?? 0} lang={lang} />
      {isPending && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 text-center text-sm text-amber-800">
          <strong>Check your email</strong> — we sent an activation link to <strong>{user.email}</strong>. Your account will be deleted if not activated within 24 hours.
        </div>
      )}
      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-8">{children}</main>
    </div>
  );
}
