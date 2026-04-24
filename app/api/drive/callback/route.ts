import { getOAuthClient } from "@/lib/google-drive";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/admin/ai-builder?drive_error=1", req.url));
  }

  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);

  const res = NextResponse.redirect(new URL("/admin/ai-builder?drive=1", req.url));
  res.cookies.set("google_drive_token", JSON.stringify(tokens), {
    path: "/",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "strict",
  });

  return res;
}
