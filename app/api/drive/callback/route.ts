import { getOAuthClient } from "@/lib/google-drive";
import { saveDriveSession } from "@/lib/drive-session";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const cookieStore = cookies();
  const expectedState = cookieStore.get("drive_oauth_state")?.value;

  // Always clear the state cookie regardless of outcome
  const clearState = (res: NextResponse) => {
    res.cookies.set("drive_oauth_state", "", { path: "/", maxAge: 0 });
    return res;
  };

  if (error || !code) {
    return clearState(NextResponse.redirect(new URL("/admin/ai-builder?drive_error=1", req.url)));
  }

  // Verify CSRF state — reject if missing or mismatched
  if (!expectedState || !state || state !== expectedState) {
    return clearState(NextResponse.redirect(new URL("/admin/ai-builder?drive_error=1", req.url)));
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/auth/login", req.url));

  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);

  const sessionId = await saveDriveSession(user.id, tokens);

  const res = NextResponse.redirect(new URL("/admin/ai-builder?drive=1", req.url));
  clearState(res);
  res.cookies.set("drive_session", sessionId, {
    path: "/",
    httpOnly: true,
    secure: true,
    maxAge: 60 * 60, // 1 hour — matches DB expiry
    sameSite: "strict",
  });

  return res;
}
