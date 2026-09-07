import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { listGnahatumTeachers } from "@/lib/gnahatum/teachers";

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

  const teachers = await listGnahatumTeachers(admin, user.id);
  return Response.json({ teachers });
}
