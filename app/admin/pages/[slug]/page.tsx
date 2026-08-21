import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPageForEdit } from "@/lib/landing/store";
import { PageEditor } from "@/components/admin/landing/page-editor";

export const dynamic = "force-dynamic";

export default async function EditPage({ params }: { params: { slug: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/admin");

  const page = await getPageForEdit(params.slug);
  if (!page) notFound();

  const previewHref = page.slug === "home" ? "/" : `/${page.slug}`;
  return <PageEditor initial={page} previewHref={previewHref} />;
}
