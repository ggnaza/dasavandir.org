import { getEfficacyUser, requireAuth, requireAdmin } from "@/lib/efficacy/auth";
import { efficacyDb } from "@/lib/efficacy/db";

export async function GET() {
  const user = await getEfficacyUser();
  const denied = requireAuth(user) ?? requireAdmin(user!);
  if (denied) return denied;

  const db = efficacyDb();
  const { data, error } = await db
    .from("usage_stats")
    .select("*, profile:user_id(id, full_name, email)")
    .order("day", { ascending: false })
    .limit(500);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}
