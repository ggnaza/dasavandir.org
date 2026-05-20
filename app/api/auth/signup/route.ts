import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureProfile } from "@/lib/auth/ensure-profile";
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
    const msg = error.message?.toLowerCase() ?? "";
    if (msg.includes("already registered") || msg.includes("already been registered") || msg.includes("user already exists")) {
      return new Response("An account with this email already exists. Try signing in instead.", { status: 400 });
    }
    if (msg.includes("invalid email")) {
      return new Response("Please enter a valid email address.", { status: 400 });
    }
    if (msg.includes("password")) {
      return new Response("Password does not meet requirements.", { status: 400 });
    }
    return new Response(error.message || "Failed to create account", { status: 400 });
  }

  // Supabase returns a fake success with empty identities when email is already registered + confirmations enabled
  if (data.user && data.user.identities?.length === 0) {
    return new Response("An account with this email already exists. Try signing in instead.", { status: 400 });
  }

  const userId = data.user?.id;
  if (userId) {
    const admin = createAdminClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dasavandir.org";

    // Defensive: ensure profile exists (see lib/auth/ensure-profile.ts and CLAUDE.md).
    // The trigger has an EXCEPTION handler that turns failures into warnings,
    // so the profile may not exist after signUp.
    await ensureProfile(admin, { id: userId, email, user_metadata: { full_name } });
    // Mark as pending (ensureProfile defaults to 'active'; signups need activation)
    await admin.from("profiles").update({ status: "pending", full_name }).eq("id", userId);

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

  return Response.json({ success: true, needsConfirmation: true });
}
