import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  let body: { lessonId?: string; userId?: string; duration?: number };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const { lessonId, duration } = body;
  if (!lessonId || typeof duration !== "number" || duration < 5 || duration > 86400) {
    return new Response("Invalid payload", { status: 400 });
  }

  const admin = createAdminClient();
  await admin.from("lesson_sessions").insert({
    user_id: user.id,
    lesson_id: lessonId,
    duration_seconds: duration,
  });

  return new Response("ok");
}
