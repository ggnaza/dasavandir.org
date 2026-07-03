import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/presence — heartbeat: stamp the current user's last_seen_at.
// Best-effort: if the last_seen_at column doesn't exist yet (migration not run),
// the update simply errors and is ignored — nothing else depends on it.
export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(null, { status: 204 });

  const admin = createAdminClient();
  await admin.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", user.id);
  return new Response(null, { status: 204 });
}
