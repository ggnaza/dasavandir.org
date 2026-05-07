import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/captcha";
import { sendActivationEmail } from "@/lib/email";
import { z } from "zod";

const schema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  full_name: z.string().min(1).max(200),
  captcha_token: z.string().optional().default(""),
});

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
  const { allowed } = await checkRateLimit(`auth:signup:${ip}`, 5, 60 * 60_000);
  if (!allowed) return rateLimitResponse({ limit: 5, windowSecs: 3600 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const { email, password, full_name, captcha_token } = parsed.data;

  const captchaOk = await verifyTurnstile(captcha_token, ip === "unknown" ? undefined : ip);
  if (!captchaOk) return new Response("CAPTCHA verification failed", { status: 400 });

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name } },
  });

  if (error) {
    console.error("[auth/signup]", error);
    return new Response("Failed to create account", { status: 400 });
  }

  const userId = data.user?.id;
  if (userId) {
    const admin = createAdminClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dasavandir.org";

    // Mark profile as pending and create activation token
    const { data: tokenRow } = await admin
      .from("activation_tokens")
      .insert({ user_id: userId })
      .select("token")
      .single();

    if (tokenRow) {
      await admin.from("profiles").update({ status: "pending" }).eq("id", userId);

      const activationUrl = `${siteUrl}/api/auth/activate?token=${tokenRow.token}`;
      try {
        await sendActivationEmail({ to: email, fullName: full_name, activationUrl });
      } catch (emailErr) {
        console.error("[signup] activation email failed", emailErr);
        // Don't block signup if email fails — mark active so user isn't stuck
        await admin.from("profiles").update({ status: "active" }).eq("id", userId);
      }
    }
  }

  return Response.json({ success: true });
}
