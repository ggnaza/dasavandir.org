import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import { getLang } from "@/lib/i18n";
import { redirect } from "next/navigation";
import { ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, email, avatar_url, region, linkedin_url, bio")
    .eq("id", user.id)
    .single();

  const lang = getLang(cookies().get("lang")?.value);

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">My profile</h1>
      <p className="text-sm text-gray-500 mb-6">Your personal info, avatar, language, and password.</p>
      <ProfileForm
        initial={{
          full_name: profile?.full_name ?? "",
          email: profile?.email ?? user.email ?? "",
          avatar_url: profile?.avatar_url ?? null,
          region: profile?.region ?? "",
          linkedin_url: profile?.linkedin_url ?? "",
          bio: profile?.bio ?? "",
        }}
        lang={lang}
      />
    </div>
  );
}
