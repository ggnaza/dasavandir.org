import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUrl } from "@/lib/google-drive";
import { randomBytes } from "crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return new Response("Forbidden", { status: 403 });

  const state = randomBytes(32).toString("hex");
  const url = getAuthUrl(state);

  const res = NextResponse.redirect(url);
  res.cookies.set("drive_oauth_state", state, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax", // lax required — browser sends cookie on redirect back from Google
    maxAge: 10 * 60, // 10 minutes — enough to complete the OAuth flow
  });
  return res;
}
