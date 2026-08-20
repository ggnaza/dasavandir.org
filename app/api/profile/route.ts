import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// PATCH /api/profile — the logged-in user updates their OWN profile.
// Reads/writes the caller's own row via the service-role client (RLS on profiles has no
// self-write policy — see CLAUDE.md). Only whitelisted, non-privileged fields are writable:
// role/status/email are NOT here, so this can never be used to self-escalate.
const schema = z.object({
  full_name: z.string().trim().min(1).max(200).optional(),
  region: z.string().trim().max(120).optional().or(z.literal("")),
  linkedin_url: z
    .string()
    .trim()
    .max(300)
    .url()
    .refine((u) => /(^https?:\/\/)?([a-z0-9-]+\.)*linkedin\.com\//i.test(u), "Must be a LinkedIn URL")
    .optional()
    .or(z.literal("")),
  bio: z.string().trim().max(1000).optional().or(z.literal("")),
});

export async function PATCH(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.issues[0]?.message ?? "Invalid input" }), { status: 400 });
  }

  // Normalise empty strings to null so cleared fields don't store "".
  const update: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) update[k] = v === "" ? null : v;
  }
  if (Object.keys(update).length === 0) {
    return new Response(JSON.stringify({ error: "Nothing to update" }), { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update(update).eq("id", user.id);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return Response.json({ ok: true });
}
