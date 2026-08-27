import { getEfficacyUser, requireAuth } from "@/lib/efficacy/auth";
import { efficacyDb } from "@/lib/efficacy/db";

export async function GET() {
  const user = await getEfficacyUser();
  const denied = requireAuth(user);
  if (denied) return denied;

  const db = efficacyDb();
  const { data, error } = await db
    .from("lesson_observations")
    .select("*, ldm:ldm_id(id, full_name)")
    .eq("teacher_id", user!.id)
    .eq("sent", true)
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}
