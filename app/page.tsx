import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getLang } from "@/lib/i18n";
import { HomeClient } from "./home-client";

export const dynamic = "force-dynamic";

async function getPublishedCourses() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("courses")
    .select("id, title, description, cover_image_url, is_paid, price_amd, language")
    .eq("published", true)
    .order("created_at", { ascending: false })
    .limit(6);
  return data ?? [];
}

export default async function Home() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const admin = createAdminClient();
    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
    redirect(profile?.role === "admin" ? "/admin" : "/learn");
  }

  const lang = getLang(cookies().get("lang")?.value);
  const courses = await getPublishedCourses();

  return <HomeClient courses={courses} lang={lang} />;
}
