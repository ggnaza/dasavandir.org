import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const admin = createAdminClient();

  // Find pending users whose 24h window has expired
  const { data: expired } = await admin
    .from("profiles")
    .select("id")
    .eq("status", "pending")
    .lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  if (!expired || expired.length === 0) {
    return Response.json({ deleted: 0 });
  }

  let deleted = 0;
  for (const profile of expired) {
    const { error } = await admin.auth.admin.deleteUser(profile.id);
    if (!error) deleted++;
    else console.error("[cleanup-unverified] failed to delete", profile.id, error);
  }

  console.log(`[cleanup-unverified] deleted ${deleted} unverified accounts`);
  return Response.json({ deleted });
}
