import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";
import { sendAnnouncementEmail } from "@/lib/email";

// Runs daily at 04:00 UTC = 08:00 Armenia time (UTC+4)
// Posts today's timetable as an announcement to all enrolled learners.
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  // "Today" in Armenia time: UTC+4, so add 4h to UTC before taking the date
  const nowUtc = new Date();
  const armeniaMs = nowUtc.getTime() + 4 * 60 * 60 * 1000;
  const today = new Date(armeniaMs).toISOString().slice(0, 10); // YYYY-MM-DD

  const { data: entries } = await admin
    .from("timetable_entries")
    .select("*, courses(id, title)")
    .eq("date", today)
    .order("start_time");

  if (!entries?.length) return Response.json({ sent: 0 });

  // Group by course
  const byCourse: Record<string, typeof entries> = {};
  for (const e of entries) {
    if (!byCourse[e.course_id]) byCourse[e.course_id] = [];
    byCourse[e.course_id].push(e);
  }

  let sent = 0;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dasavandir.org";

  for (const [courseId, courseEntries] of Object.entries(byCourse)) {
    // Only for courses with timetable enabled
    const { data: course } = await admin
      .from("courses")
      .select("title, timetable_enabled")
      .eq("id", courseId)
      .single();
    if (!course?.timetable_enabled) continue;

    const dateStr = new Date(today + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });

    const agendaLines = courseEntries.map((e) => {
      const timeStr = e.end_time
        ? `${e.start_time.slice(0, 5)} – ${e.end_time.slice(0, 5)}`
        : e.start_time.slice(0, 5);
      const locationLabel = e.location_type === "online"
        ? `Online: ${e.location}`
        : `📍 ${e.location}`;
      const line = `🕐 ${timeStr}  ${e.title}  —  ${locationLabel}`;
      return e.description ? `${line}\n   ${e.description}` : line;
    });

    const announcementTitle = `📅 Today's agenda — ${dateStr}`;
    const announcementBody = agendaLines.join("\n\n");

    // Use the first admin as author_id (system announcement)
    const { data: adminProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .limit(1)
      .single();

    if (!adminProfile) continue;

    await admin.from("announcements").insert({
      course_id: courseId,
      author_id: adminProfile.id,
      title: announcementTitle,
      body: announcementBody,
    });

    const announcementsUrl = `${siteUrl}/learn/courses/${courseId}/announcements`;

    const { data: enrollments } = await admin
      .from("enrollments")
      .select("user_id, profiles(full_name, email)")
      .eq("course_id", courseId);

    for (const enr of enrollments ?? []) {
      const p = enr.profiles as any;
      await createNotification({
        user_id: enr.user_id,
        type: "announcement",
        title: announcementTitle,
        body: announcementBody.slice(0, 200),
        link: `/learn/courses/${courseId}/announcements`,
      });
      if (p?.email) {
        sendAnnouncementEmail({
          to: p.email,
          firstName: p.full_name?.split(" ")[0] || "",
          announcementTitle,
          announcementBody,
          courseTitle: course.title,
          announcementsUrl,
        }).catch((err) => console.error("[daily-timetable/email]", err));
      }
      sent++;
    }
  }

  return Response.json({ today, sent });
}
