import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dasavandir.org";

  if (!token) {
    return NextResponse.redirect(`${siteUrl}/auth/login?error=invalid_token`);
  }

  const admin = createAdminClient();

  const { data: tokenRow, error } = await admin
    .from("activation_tokens")
    .select("user_id, expires_at")
    .eq("token", token)
    .single();

  if (error || !tokenRow) {
    return NextResponse.redirect(`${siteUrl}/auth/login?error=invalid_token`);
  }

  if (new Date(tokenRow.expires_at) < new Date()) {
    await admin.from("activation_tokens").delete().eq("token", token);
    return NextResponse.redirect(`${siteUrl}/auth/login?error=token_expired`);
  }

  await Promise.all([
    admin.from("profiles").update({ status: "active" }).eq("id", tokenRow.user_id),
    admin.from("activation_tokens").delete().eq("token", token),
  ]);

  return NextResponse.redirect(`${siteUrl}/auth/login?activated=true`);
}

const postSchema = z.object({ full_name: z.string().trim().min(1).max(200).optional() }).optional();

/**
 * Called by /auth/set-password once an invited user has chosen a password: marks
 * the caller's own profile active, so the hourly cleanup-unverified cron does not
 * delete an account that was accepted. Optionally records the name the invitee
 * typed (only if the profile has none — never overwrites an admin-set name).
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown = undefined;
  const raw = await req.text();
  if (raw.trim()) {
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
  }
  const input = postSchema.safeParse(body);
  if (!input.success) return NextResponse.json({ error: "Invalid name" }, { status: 400 });

  const admin = createAdminClient();
  // Defensive: the profile may be missing if the signup trigger silently failed (CLAUDE.md).
  await ensureProfile(admin, user);
  const { error } = await admin.from("profiles").update({ status: "active" }).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const name = input.data?.full_name;
  if (name) {
    const { error: nameErr } = await admin
      .from("profiles")
      .update({ full_name: name })
      .eq("id", user.id)
      .or("full_name.is.null,full_name.eq.");
    if (nameErr) return NextResponse.json({ error: nameErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
