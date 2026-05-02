import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit-log";
import { z } from "zod";

const schema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
  const { allowed } = await checkRateLimit(`auth:login:${ip}`, 10, 15 * 60_000);
  if (!allowed) return rateLimitResponse({ limit: 10, windowSecs: 900 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Log failed attempt — use null actor since they're not authenticated yet
    await logAudit("login_failed", null, req, { email: parsed.data.email });
    return new Response("Invalid email or password", { status: 401 });
  }

  return new Response("OK");
}
