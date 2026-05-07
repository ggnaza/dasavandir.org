import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest } from "next/server";
import { z } from "zod";

const reminderSchema = z.object({
  type: z.enum(["new_lesson", "not_started", "not_completed", "custom"]),
  days_after_publish: z.number().int().positive().nullable().optional(),
  send_at_date: z.string().nullable().optional(),
  custom_subject: z.string().max(200).nullable().optional(),
  custom_message: z.string().max(1000).nullable().optional(),
  is_active: z.boolean().optional(),
});

const saveSchema = z.object({
  lessonId: z.string().uuid(),
  courseId: z.string().uuid(),
  reminders: z.array(reminderSchema).max(20),
});

async function authorizeEditor(userId: string) {
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", userId).single();
  return profile && ["admin", "course_creator"].includes(profile.role);
}

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const lessonId = req.nextUrl.searchParams.get("lessonId");
  if (!lessonId) return new Response("Missing lessonId", { status: 400 });

  if (!(await authorizeEditor(user.id))) return new Response("Forbidden", { status: 403 });

  const admin = createAdminClient();
  const { data: reminders } = await admin
    .from("lesson_reminders")
    .select("*")
    .eq("lesson_id", lessonId)
    .order("created_at");

  return Response.json(reminders ?? []);
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  if (!(await authorizeEditor(user.id))) return new Response("Forbidden", { status: 403 });

  const parsed = saveSchema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });
  const { lessonId, courseId, reminders } = parsed.data;

  const admin = createAdminClient();

  // Replace all reminders for this lesson
  await admin.from("lesson_reminders").delete().eq("lesson_id", lessonId);

  if (reminders.length > 0) {
    const rows = reminders.map((r) => ({
      lesson_id: lessonId,
      course_id: courseId,
      type: r.type,
      days_after_publish: r.days_after_publish ?? null,
      send_at_date: r.send_at_date ?? null,
      custom_subject: r.custom_subject ?? null,
      custom_message: r.custom_message ?? null,
      is_active: r.is_active ?? true,
    }));
    await admin.from("lesson_reminders").insert(rows);
  }

  return Response.json({ ok: true });
}
