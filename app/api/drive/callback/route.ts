import { getOAuthClient } from "@/lib/google-drive";
import { saveDriveSession } from "@/lib/drive-session";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/admin/ai-builder?drive_error=1", req.url));
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/auth/login", req.url));

  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);

  const sessionId = await saveDriveSession(user.id, tokens);

  const res = NextResponse.redirect(new URL("/admin/ai-builder?drive=1", req.url));
  res.cookies.set("drive_session", sessionId, {
    path: "/",
    httpOnly: true,
    secure: true,
    maxAge: 60 * 60, // 1 hour — matches DB expiry
    sameSite: "strict",
  });

  return res;
}
