import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getLang } from "@/lib/i18n";
import { getPageForPublic, getMenu } from "@/lib/landing/store";
import { PublicPage } from "@/components/landing/public-page";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const admin = createAdminClient();
    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
    redirect(profile?.role === "admin" ? "/admin" : "/learn");
  }

  const lang = getLang(cookies().get("lang")?.value);
  const [page, nav, footer] = await Promise.all([
    getPageForPublic("home"),
    getMenu("nav"),
    getMenu("footer"),
  ]);

  // `home` always resolves (falls back to DEFAULT_HOME_BLOCKS), but guard defensively.
  return <PublicPage blocks={page?.blocks ?? []} nav={nav} footer={footer} lang={lang} />;
}
