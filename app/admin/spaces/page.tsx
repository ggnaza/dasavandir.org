import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrgId } from "@/lib/org";
import { SpacesManager } from "./spaces-manager";

export const dynamic = "force-dynamic";

export default async function SpacesPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  // Spaces are org-level configuration — admin only (the layout lets creators/managers into /admin).
  if (profile?.role !== "admin") redirect("/admin");

  const orgId = await getCurrentOrgId(admin);

  const spacesRes = orgId
    ? await admin.from("spaces").select("id, name, ord").eq("org_id", orgId).order("ord")
    : { data: [] };
  const courseRes = orgId
    ? await admin.from("courses").select("space_id").eq("org_id", orgId)
    : { data: [] };

  const counts: Record<string, number> = {};
  for (const row of courseRes.data ?? []) {
    const sid = (row as { space_id: string | null }).space_id;
    if (sid) counts[sid] = (counts[sid] ?? 0) + 1;
  }

  const initialSpaces = (spacesRes.data ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
    ord: s.ord as number,
    courseCount: counts[s.id as string] ?? 0,
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Spaces</h1>
      <p className="text-sm text-gray-500 mb-6 max-w-2xl">
        Spaces separate audiences within your organization — for example Learning, HR Onboarding, and
        Recruitment Training. A learner only sees the courses in the spaces they belong to.
      </p>
      <SpacesManager initialSpaces={initialSpaces} />
    </div>
  );
}
