import { getEfficacyUser, requireAuth, requireLdm } from "@/lib/efficacy/auth";
import { efficacyDb } from "@/lib/efficacy/db";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await getEfficacyUser();
  const denied = requireAuth(user) ?? requireLdm(user!);
  if (denied) return denied;

  const db = efficacyDb();
  const { data: obs } = await db
    .from("lesson_observations")
    .select("id, ldm_id, sent")
    .eq("id", params.id)
    .maybeSingle();

  if (!obs) return Response.json({ error: "Not found" }, { status: 404 });
  if (user!.role !== "admin" && obs.ldm_id !== user!.id)
    return Response.json({ error: "Forbidden" }, { status: 403 });
  if (obs.sent) return Response.json({ error: "Already sent" }, { status: 400 });

  const { data, error } = await db
    .from("lesson_observations")
    .update({ sent: true, sent_at: new Date().toISOString() })
    .eq("id", params.id)
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}
