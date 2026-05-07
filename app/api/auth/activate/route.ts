import { createAdminClient } from "@/lib/supabase/admin";
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

  return NextResponse.redirect(`${siteUrl}/learn?activated=true`);
}
