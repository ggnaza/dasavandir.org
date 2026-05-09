import { createAdminClient } from "@/lib/supabase/admin";
import { sendActivationEmail } from "@/lib/email";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { z } from "zod";

const schema = z.object({ email: z.string().email().max(254) });

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
  const { allowed } = await checkRateLimit(`resend-activation:${ip}`, 3, 60 * 60_000);
  if (!allowed) return rateLimitResponse({ limit: 3, windowSecs: 3600 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const { email } = parsed.data;
  const admin = createAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dasavandir.org";

  // Look up user by email
  const { data: authUser } = await admin.auth.admin.getUserByEmail(email);
  if (!authUser) {
    // Return success regardless to prevent email enumeration
    return Response.json({ ok: true });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("status, full_name")
    .eq("id", authUser.id)
    .single();

  if (profile?.status !== "pending") {
    return Response.json({ ok: true });
  }

  // Delete old token and create a fresh one
  await admin.from("activation_tokens").delete().eq("user_id", authUser.id);
  const { data: tokenRow } = await admin
    .from("activation_tokens")
    .insert({ user_id: authUser.id })
    .select("token")
    .single();

  if (tokenRow) {
    const activationUrl = `${siteUrl}/api/auth/activate?token=${tokenRow.token}`;
    await sendActivationEmail({
      to: email,
      fullName: profile?.full_name ?? "",
      activationUrl,
    }).catch((err) => console.error("[resend-activation] email failed", err));
  }

  return Response.json({ ok: true });
}
