import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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
  if (profile?.role !== "admin") return new Response("Forbidden", { status: 403 });

  const { courseId } = await req.json();

  const { data: lessons } = await admin
    .from("lessons")
    .select("id, title, video_url")
    .eq("course_id", courseId)
    .not("video_url", "is", null);

  const apiKey = process.env.GOOGLE_API_KEY;
  const results: { title: string; status: string; duration_seconds: number | null }[] = [];

  for (const lesson of lessons ?? []) {
    if (!lesson.video_url?.includes("drive.google.com")) {
      results.push({ title: lesson.title, status: "skipped (not a Drive URL)", duration_seconds: null });
      continue;
    }

    const fileId = extractDriveFileId(lesson.video_url);
    if (!fileId) {
      results.push({ title: lesson.title, status: "could not extract file ID", duration_seconds: null });
      continue;
    }

    if (!apiKey) {
      results.push({ title: lesson.title, status: "GOOGLE_API_KEY not set", duration_seconds: null });
      continue;
    }

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=videoMediaMetadata&key=${apiKey}`
    );
    const data = await res.json();

    if (!res.ok) {
      results.push({ title: lesson.title, status: `Drive API error: ${data.error?.message ?? res.status}`, duration_seconds: null });
      continue;
    }

    const ms = data.videoMediaMetadata?.durationMillis;
    if (!ms) {
      results.push({ title: lesson.title, status: "no videoMediaMetadata returned", duration_seconds: null });
      continue;
    }

    const duration_seconds = Math.round(Number(ms) / 1000);
    await admin.from("lessons").update({ duration_seconds }).eq("id", lesson.id);
    results.push({ title: lesson.title, status: "ok", duration_seconds });
  }

  return Response.json({ results });
}
