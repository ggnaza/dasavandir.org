export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || "(not set)",
    DRIVE_SESSION_SECRET: !!process.env.DRIVE_SESSION_SECRET,
    UPSTASH_REDIS_REST_URL: !!process.env.UPSTASH_REDIS_REST_URL,
  });
}
