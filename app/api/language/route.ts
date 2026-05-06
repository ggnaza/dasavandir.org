import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { lang } = await req.json();
  if (!["en", "hy"].includes(lang)) return new Response("Invalid", { status: 400 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set("lang", lang, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  return res;
}
