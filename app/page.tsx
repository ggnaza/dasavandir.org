import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getLang } from "@/lib/i18n";
import { getPageForPublic, getMenu } from "@/lib/landing/store";
import { PublicPage } from "@/components/landing/public-page";
import { callbackForStrayAuthParams } from "@/lib/auth/stray-oauth-params";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  // An OAuth result that Supabase sent to the homepage instead of /auth/callback
  // (its fallback when redirectTo is not allow-listed) must still finish signing in.
  const strayCallback = callbackForStrayAuthParams(searchParams);
  if (strayCallback) redirect(strayCallback);

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
