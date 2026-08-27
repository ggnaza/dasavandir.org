import { getEfficacyUser, requireAuth, requireLdm } from "@/lib/efficacy/auth";
import { efficacyDb } from "@/lib/efficacy/db";

export async function GET() {
  const user = await getEfficacyUser();
  const denied = requireAuth(user) ?? requireLdm(user!);
  if (denied) return denied;

  const db = efficacyDb();

  if (user!.role === "admin") {
    const { data, error } = await db
      .from("ldm_teacher_assignments")
      .select("teacher_id, school, region, teacher:teacher_id(id, full_name, email)")
      .order("created_at", { ascending: false });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json(data);
  }

  const { data, error } = await db
    .from("ldm_teacher_assignments")
    .select("teacher_id, school, region, teacher:teacher_id(id, full_name, email)")
    .eq("ldm_id", user!.id)
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}
