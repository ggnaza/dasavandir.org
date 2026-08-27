import { getEfficacyUser, requireAuth } from "@/lib/efficacy/auth";
import { efficacyDb } from "@/lib/efficacy/db";

export async function POST() {
  const user = await getEfficacyUser();
  const denied = requireAuth(user);
  if (denied) return denied;

  const today = new Date().toISOString().slice(0, 10);
  const db = efficacyDb();

  const { data: existing } = await db
    .from("usage_stats")
    .select("id, minutes")
    .eq("user_id", user!.id)
    .eq("day", today)
    .maybeSingle();

  if (existing) {
    await db
      .from("usage_stats")
      .update({ minutes: existing.minutes + 5, last_active_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await db.from("usage_stats").insert({
      user_id: user!.id,
      day: today,
      minutes: 5,
      last_active_at: new Date().toISOString(),
    });
  }

  return Response.json({ ok: true });
}
