import { getEfficacyUser, requireAuth } from "@/lib/efficacy/auth";
import { efficacyDb } from "@/lib/efficacy/db";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getEfficacyUser();
  const denied = requireAuth(user);
  if (denied) return denied;

  const db = efficacyDb();
  const { data, error } = await db
    .from("lesson_observations")
    .select("*, ldm:ldm_id(id, full_name)")
    .eq("id", params.id)
    .eq("teacher_id", user!.id)
    .eq("sent", true)
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(data);
}
