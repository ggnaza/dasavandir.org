import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const courseId = searchParams.get("courseId");
  if (!courseId) return new Response("Missing courseId", { status: 400 });

  const admin = createAdminClient();

  const { data: sessions } = await admin
    .from("ai_coach_sessions")
    .select("id, lesson_id, started_at, last_message_at, message_count")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .order("last_message_at", { ascending: false })
    .limit(30);

  if (!sessions || sessions.length === 0) return Response.json([]);

  const lessonIds = Array.from(new Set(sessions.map((s: any) => s.lesson_id).filter(Boolean)));
  const { data: lessons } = lessonIds.length > 0
    ? await admin.from("lessons").select("id, title").in("id", lessonIds)
    : { data: [] };
  const lessonMap = Object.fromEntries((lessons ?? []).map((l: any) => [l.id, l.title]));

  const sessionIds = sessions.map((s: any) => s.id);
  const { data: firstMessages } = await admin
    .from("ai_coach_messages")
    .select("session_id, content")
    .in("session_id", sessionIds)
    .eq("role", "user")
    .order("created_at", { ascending: true });

  const previewBySession: Record<string, string> = {};
  for (const m of firstMessages ?? []) {
    if (!previewBySession[m.session_id]) previewBySession[m.session_id] = m.content;
  }

  return Response.json(
    sessions.map((s: any) => ({
      id: s.id,
      lessonTitle: s.lesson_id ? (lessonMap[s.lesson_id] ?? null) : null,
      startedAt: s.started_at,
      lastMessageAt: s.last_message_at,
      messageCount: s.message_count ?? 0,
      preview: previewBySession[s.id] ?? null,
    }))
  );
}
