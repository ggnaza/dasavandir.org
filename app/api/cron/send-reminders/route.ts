import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";
import { sendLessonReminderEmail } from "@/lib/email";

// Vercel Cron calls this with Authorization: Bearer <CRON_SECRET>
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Find all active scheduled reminders whose trigger date is today:
  //   - days_after_publish: lesson.created_at::date + days_after_publish = today
  //   - send_at_date: exact date match
  const { data: reminders } = await admin
    .from("lesson_reminders")
    .select(`
      id,
      lesson_id,
      course_id,
      type,
      days_after_publish,
      send_at_date,
      custom_subject,
      custom_message,
      lessons ( title, created_at, course_id, courses ( title ) )
    `)
    .eq("is_active", true)
    .in("type", ["not_started", "not_completed", "custom"]);

  if (!reminders?.length) return Response.json({ processed: 0 });

  let processed = 0;

  for (const reminder of reminders) {
    const lesson = reminder.lessons as any;
    if (!lesson) continue;

    // Check if today is the trigger date
    const lessonDate = new Date(lesson.created_at).toISOString().slice(0, 10);
    let triggers = false;

    if (reminder.days_after_publish) {
      const triggerDate = new Date(lesson.created_at);
      triggerDate.setDate(triggerDate.getDate() + reminder.days_after_publish);
      triggers = triggerDate.toISOString().slice(0, 10) === today;
    } else if (reminder.send_at_date) {
      triggers = reminder.send_at_date === today;
    }

    if (!triggers) continue;

    const courseId = reminder.course_id;
    const courseTitle = (lesson.courses as any)?.title ?? "";
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const lessonUrl = `${siteUrl}/learn/courses/${courseId}/lessons/${reminder.lesson_id}`;

    // Get enrolled users not yet notified for this reminder
    const { data: enrollments } = await admin
      .from("enrollments")
      .select("user_id")
      .eq("course_id", courseId);

    if (!enrollments?.length) continue;

    const { data: alreadySent } = await admin
      .from("reminder_logs")
      .select("user_id")
      .eq("lesson_reminder_id", reminder.id);

    const alreadySentIds = new Set((alreadySent ?? []).map((r) => r.user_id));
    const pendingIds = enrollments.map((e) => e.user_id).filter((id) => !alreadySentIds.has(id));
    if (!pendingIds.length) continue;

    // For not_started/not_completed: filter by lesson interaction
    let targetIds = pendingIds;

    if (reminder.type === "not_started") {
      // Users with NO lesson_sessions for this lesson (never opened it)
      const { data: sessions } = await admin
        .from("lesson_sessions")
        .select("user_id")
        .eq("lesson_id", reminder.lesson_id)
        .in("user_id", pendingIds);
      const startedIds = new Set((sessions ?? []).map((s) => s.user_id));
      targetIds = pendingIds.filter((id) => !startedIds.has(id));
    } else if (reminder.type === "not_completed") {
      // Users with NO completed progress row
      const { data: completed } = await admin
        .from("progress")
        .select("user_id")
        .eq("lesson_id", reminder.lesson_id)
        .in("user_id", pendingIds);
      const completedIds = new Set((completed ?? []).map((p) => p.user_id));
      targetIds = pendingIds.filter((id) => !completedIds.has(id));
    }

    for (const userId of targetIds) {
      const { data: authData } = await admin.auth.admin.getUserById(userId);
      const email = authData.user?.email;
      const fullName = authData.user?.user_metadata?.full_name ?? "";
      const firstName = fullName.split(" ")[0] || "";

      if (email) {
        const reminderType =
          reminder.type === "not_started" || reminder.type === "not_completed"
            ? reminder.type
            : "custom";

        await Promise.allSettled([
          sendLessonReminderEmail({
            to: email,
            firstName,
            lessonTitle: lesson.title,
            courseTitle,
            lessonUrl,
            reminderType,
            customSubject: reminder.custom_subject,
            customMessage: reminder.custom_message,
          }),
          createNotification({
            user_id: userId,
            type: `reminder_${reminder.type}`,
            title:
              reminder.type === "not_started"
                ? `Don't forget to start: ${lesson.title}`
                : reminder.type === "not_completed"
                ? `Still time to finish: ${lesson.title}`
                : reminder.custom_subject ?? `Reminder: ${lesson.title}`,
            body: reminder.custom_message ?? undefined,
            link: `/learn/courses/${courseId}/lessons/${reminder.lesson_id}`,
          }),
        ]);
      }

      // Log even if no email (marks as "processed" so we don't retry)
      await admin
        .from("reminder_logs")
        .insert({ lesson_reminder_id: reminder.id, user_id: userId })
        .then(() => null, () => null);
    }

    processed++;
  }

  return Response.json({ processed, date: today });
}
