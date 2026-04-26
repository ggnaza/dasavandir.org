import { verifyTurnstile } from "@/lib/captcha";

export async function POST(req: Request) {
  const { token } = await req.json();
  if (!token) return new Response("Missing token", { status: 400 });

  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? undefined;
  const ok = await verifyTurnstile(token, ip);

  if (!ok) return new Response("CAPTCHA verification failed", { status: 400 });
  return new Response(null, { status: 204 });
}
