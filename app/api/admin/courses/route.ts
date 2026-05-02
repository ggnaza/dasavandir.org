import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return new Response("Forbidden", { status: 403 });

  const { data, error } = await admin.from("courses").select("id, title").order("title");
  if (error) {
    console.error("[admin/courses]", error);
    return new Response("Failed to fetch courses", { status: 500 });
  }
  return Response.json({ courses: data });
}
