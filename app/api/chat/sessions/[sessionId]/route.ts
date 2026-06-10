import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { sessionId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();

  // Verify the session belongs to this user
  const { data: session } = await admin
    .from("ai_coach_sessions")
    .select("id, lesson_id, course_id, started_at, last_message_at, message_count")
    .eq("id", params.sessionId)
    .eq("user_id", user.id)
    .single();

  if (!session) return new Response("Not found", { status: 404 });

  const { data: messages } = await admin
    .from("ai_coach_messages")
    .select("role, content, created_at")
    .eq("session_id", params.sessionId)
    .order("created_at", { ascending: true });

  return Response.json({ session, messages: messages ?? [] });
}
