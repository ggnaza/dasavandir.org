import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const VALID_MODELS = [
  "gpt-4o-mini",
  "gemini-2.0-flash",
  "gemini-2.5-flash-preview-04-17",
  "gemini-2.5-pro-preview-05-06",
] as const;

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("Forbidden");
  return admin;
}

export async function GET() {
  try {
    const admin = await requireAdmin();
    const { data } = await admin.from("settings").select("key, value");
    const settings: Record<string, string> = {};
    for (const row of data ?? []) settings[row.key] = row.value;
    if (!settings.ai_coach_model) settings.ai_coach_model = "gpt-4o-mini";
    return Response.json({ settings });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 403 });
  }
}

const patchSchema = z.object({
  ai_coach_model: z.enum(VALID_MODELS),
});

export async function PATCH(req: Request) {
  try {
    const admin = await requireAdmin();
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return new Response(JSON.stringify({ error: "Invalid input" }), { status: 400 });

    const { ai_coach_model } = parsed.data;
    const { error } = await admin.from("settings").upsert(
      { key: "ai_coach_model", value: ai_coach_model, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

    return Response.json({ ok: true });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 403 });
  }
}
