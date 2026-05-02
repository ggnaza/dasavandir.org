import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_VIDEO_HOSTS = ["drive.google.com", "docs.google.com"];

function isAllowedVideoUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return ALLOWED_VIDEO_HOSTS.some((h) => hostname === h || hostname.endsWith("." + h));
  } catch {
    return false;
  }
}

function extractDriveFileId(url: string): string | null {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "course_creator", "course_manager"].includes(profile?.role ?? "")) {
    return new Response("Forbidden", { status: 403 });
  }

  const { videoUrl } = await req.json();
  if (!videoUrl) return new Response("Missing videoUrl", { status: 400 });

  if (!isAllowedVideoUrl(videoUrl)) {
    return Response.json({ duration_seconds: null });
  }

  const fileId = extractDriveFileId(videoUrl);
  if (!fileId) return Response.json({ duration_seconds: null });

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return Response.json({ duration_seconds: null });

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=videoMediaMetadata&key=${apiKey}`
  );
  if (!res.ok) return Response.json({ duration_seconds: null });

  const data = await res.json();
  const ms = data.videoMediaMetadata?.durationMillis;
  const duration_seconds = ms ? Math.round(Number(ms) / 1000) : null;

  return Response.json({ duration_seconds });
}
