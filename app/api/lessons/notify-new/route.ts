import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";
import { sendNewLessonEmail } from "@/lib/email";
import { z } from "zod";

const bodySchema = z.object({
  lessonId: z.string().uuid(),
});

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "course_creator"].includes(profile.role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });
  const { lessonId } = parsed.data;

  // Get lesson + course info
  const { data: lesson } = await admin
    .from("lessons")
    .select("id, title, course_id, courses(title)")
    .eq("id", lessonId)
    .single();
  if (!lesson) return new Response("Lesson not found", { status: 404 });

  const courseTitle = (lesson.courses as any)?.title ?? "";
  const courseId = lesson.course_id;

  // Get or create the new_lesson reminder for this lesson
  let { data: reminder } = await admin
    .from("lesson_reminders")
    .select("id")
    .eq("lesson_id", lessonId)
    .eq("type", "new_lesson")
    .single();

  if (!reminder) {
    const { data: inserted } = await admin
      .from("lesson_reminders")
      .insert({ lesson_id: lessonId, course_id: courseId, type: "new_lesson" })
      .select("id")
      .single();
    reminder = inserted;
  }

  if (!reminder) return new Response("Failed to get reminder record", { status: 500 });

  // Get enrolled users not yet notified
  const { data: enrollments } = await admin
    .from("enrollments")
    .select("user_id")
    .eq("course_id", courseId);

  if (!enrollments?.length) return Response.json({ sent: 0 });

  // Find users already notified
  const { data: alreadySent } = await admin
    .from("reminder_logs")
    .select("user_id")
    .eq("lesson_reminder_id", reminder.id);

  const alreadySentIds = new Set((alreadySent ?? []).map((r) => r.user_id));
  const pendingUserIds = enrollments
    .map((e) => e.user_id)
    .filter((id) => !alreadySentIds.has(id));

  if (!pendingUserIds.length) return Response.json({ sent: 0 });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const lessonUrl = `${siteUrl}/learn/courses/${courseId}/lessons/${lessonId}`;

  let sent = 0;
  for (const userId of pendingUserIds) {
    const { data: authUser } = await admin.auth.admin.getUserById(userId);
    const email = authUser.user?.email;
    const fullName = authUser.user?.user_metadata?.full_name ?? "";
    const firstName = fullName.split(" ")[0] || "";

    if (email) {
      await Promise.allSettled([
        sendNewLessonEmail({ to: email, firstName, lessonTitle: lesson.title, courseTitle, lessonUrl }),
        createNotification({
          user_id: userId,
          type: "new_lesson",
          title: `New lesson: ${lesson.title}`,
          body: `A new lesson has been added to ${courseTitle}.`,
          link: `/learn/courses/${courseId}/lessons/${lessonId}`,
        }),
      ]);
    }

    await admin
      .from("reminder_logs")
      .insert({ lesson_reminder_id: reminder.id, user_id: userId })
      .then(() => null, () => null); // ignore duplicate conflicts (unique constraint)

    sent++;
  }

  return Response.json({ sent });
}
