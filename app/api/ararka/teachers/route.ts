import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile) return Response.json({ error: "No profile" }, { status: 403 });

  const isLdm =
    profile.role === "admin" ||
    profile.role === "course_manager" ||
    profile.role === "space_manager";

  if (!isLdm) {
    return Response.json({ error: "Not an LDM" }, { status: 403 });
  }

  const { data: teachers, error } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .contains("modules", ["ararka"])
    .neq("id", user.id)
    .order("full_name");

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ teachers: teachers ?? [] });
}
