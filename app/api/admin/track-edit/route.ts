import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit-log";
import { z } from "zod";

const schema = z.object({
  action: z.enum(["lesson_edit_open", "lesson_edit_save"]),
  lessonId: z.string().uuid(),
  courseId: z.string().uuid(),
});

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  const allowed = ["admin", "course_creator", "course_manager"];
  if (!allowed.includes(profile?.role ?? "")) return new Response("Forbidden", { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  await logAudit(parsed.data.action, user.id, req, {
    lesson_id: parsed.data.lessonId,
    course_id: parsed.data.courseId,
  });

  return new Response("OK");
}
