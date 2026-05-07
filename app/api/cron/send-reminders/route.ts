import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";
import { sendLessonReminderEmail } from "@/lib/email";

// Vercel Cron calls this daily with Authorization: Bearer <CRON_SECRET>
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

  // Get all courses that have at least one scheduled reminder type configured
  const { data: courses } = await admin
    .from("courses")
    .select("id, title, remind_not_started_days, remind_not_completed_days")
    .or("remind_not_started_days.not.is.null,remind_not_completed_days.not.is.null");

  if (!courses?.length) return Response.json({ processed: 0 });

  let processed = 0;

  for (const course of courses) {
    // Get lessons in this course whose trigger date falls on today for either reminder type
    const { data: lessons } = await admin
      .from("lessons")
      .select("id, title, created_at")
      .eq("course_id", course.id);

    if (!lessons?.length) continue;

    // Get enrolled users for this course
    const { data: enrollments } = await admin
      .from("enrollments")
      .select("user_id")
      .eq("course_id", course.id);

    if (!enrollments?.length) continue;

    const enrolledIds = enrollments.map((e) => e.user_id);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    for (const lesson of lessons) {
      const lessonDate = new Date(lesson.created_at).toISOString().slice(0, 10);

      const types: Array<{ type: "not_started" | "not_completed"; days: number }> = [];

      if (course.remind_not_started_days) {
        const triggerDate = new Date(lesson.created_at);
        triggerDate.setDate(triggerDate.getDate() + course.remind_not_started_days);
        if (triggerDate.toISOString().slice(0, 10) === today) {
          types.push({ type: "not_started", days: course.remind_not_started_days });
        }
      }

      if (course.remind_not_completed_days) {
        const triggerDate = new Date(lesson.created_at);
        triggerDate.setDate(triggerDate.getDate() + course.remind_not_completed_days);
        if (triggerDate.toISOString().slice(0, 10) === today) {
          types.push({ type: "not_completed", days: course.remind_not_completed_days });
        }
      }

      if (!types.length) continue;

      for (const { type } of types) {
        // Find users already sent this reminder for this lesson
        const { data: alreadySent } = await admin
          .from("course_reminder_logs")
          .select("user_id")
          .eq("course_id", course.id)
          .eq("lesson_id", lesson.id)
          .eq("type", type);

        const alreadySentIds = new Set((alreadySent ?? []).map((r) => r.user_id));
        const pendingIds = enrolledIds.filter((id) => !alreadySentIds.has(id));
        if (!pendingIds.length) continue;

        // Filter by lesson interaction
        let targetIds = pendingIds;

        if (type === "not_started") {
          // Users who have never opened the lesson (no session records)
          const { data: sessions } = await admin
            .from("lesson_sessions")
            .select("user_id")
            .eq("lesson_id", lesson.id)
            .in("user_id", pendingIds);
          const startedIds = new Set((sessions ?? []).map((s) => s.user_id));
          targetIds = pendingIds.filter((id) => !startedIds.has(id));
        } else if (type === "not_completed") {
          // Users who haven't completed the lesson
          const { data: completed } = await admin
            .from("progress")
            .select("user_id")
            .eq("lesson_id", lesson.id)
            .in("user_id", pendingIds);
          const completedIds = new Set((completed ?? []).map((p) => p.user_id));
          targetIds = pendingIds.filter((id) => !completedIds.has(id));
        }

        const lessonUrl = `${siteUrl}/learn/courses/${course.id}/lessons/${lesson.id}`;

        for (const userId of targetIds) {
          const { data: authData } = await admin.auth.admin.getUserById(userId);
          const email = authData.user?.email;
          const fullName = authData.user?.user_metadata?.full_name ?? "";
          const firstName = fullName.split(" ")[0] || "";

          if (email) {
            await Promise.allSettled([
              sendLessonReminderEmail({
                to: email,
                firstName,
                lessonTitle: lesson.title,
                courseTitle: course.title,
                lessonUrl,
                reminderType: type,
              }),
              createNotification({
                user_id: userId,
                type: `reminder_${type}`,
                title:
                  type === "not_started"
                    ? `Don't forget to start: ${lesson.title}`
                    : `Still time to finish: ${lesson.title}`,
                link: `/learn/courses/${course.id}/lessons/${lesson.id}`,
              }),
            ]);
          }

          await admin
            .from("course_reminder_logs")
            .insert({ course_id: course.id, lesson_id: lesson.id, user_id: userId, type })
            .then(() => null, () => null);
        }

        processed++;
      }
    }
  }

  return Response.json({ processed, date: today });
}
