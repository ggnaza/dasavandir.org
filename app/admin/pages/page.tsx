import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listPages, listMenu } from "@/lib/landing/store";
import { PagesAdmin, type PageSummary } from "@/components/admin/landing/pages-admin";
import { MenuManager } from "@/components/admin/landing/menu-manager";

export const dynamic = "force-dynamic";

export default async function AdminPagesIndex() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/admin");

  const [pages, menu] = await Promise.all([listPages(), listMenu()]);

  const summaries: PageSummary[] = pages.map((p) => ({ slug: p.slug, title: p.title, status: p.status, is_system: p.is_system }));
  // The `home` page renders from defaults until first save — always show it.
  if (!summaries.some((s) => s.slug === "home")) {
    summaries.unshift({ slug: "home", title: { en: "Home", hy: "Գլխավոր" }, status: "published", is_system: true });
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pages</h1>
        <p className="mt-1 text-sm text-gray-500">Edit the public landing page, add marketing pages, and manage the site navigation.</p>
      </div>

      <PagesAdmin pages={summaries} />

      <MenuManager initialItems={menu} />
    </div>
  );
}
