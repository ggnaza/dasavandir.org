import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireRole, ADMIN_ROLES } from "@/lib/auth/require-role";
import { z } from "zod";
import { VALID_MODEL_IDS } from "@/lib/ai-models";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const admin = createAdminClient();
  const deny = await requireRole(admin, user.id, ADMIN_ROLES);
  if (deny) return deny;

  const { data } = await admin.from("settings").select("key, value");
  const settings: Record<string, string> = {};
  for (const row of data ?? []) settings[row.key] = row.value;
  if (!settings.ai_model) settings.ai_model = settings.ai_coach_model ?? "gpt-4o-mini";
  return Response.json({ settings });
}

const patchSchema = z.object({
  ai_model: z.enum(VALID_MODEL_IDS),
});

export async function PATCH(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const admin = createAdminClient();
  const deny = await requireRole(admin, user.id, ADMIN_ROLES);
  if (deny) return deny;

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return new Response(JSON.stringify({ error: "Invalid input" }), { status: 400 });

  const { ai_model } = parsed.data;
  const { error } = await admin.from("settings").upsert(
    { key: "ai_model", value: ai_model, updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  return Response.json({ ok: true });
}
