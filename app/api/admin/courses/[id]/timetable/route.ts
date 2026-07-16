import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";
import { sendAnnouncementEmail } from "@/lib/email";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { getTimetableAccess } from "@/lib/timetable/access";
import { z } from "zod";

/**
 * Base-agenda writes are admin + course_creator only (ADR-0005).
 *
 * assertCourseOwner() also admits any course_manager, which is wider than the
 * decision: a manager is read-only on the base unless they moderate a group, and
 * then only via the override route. TLA 2026 has 9 managers but 5 group moderators,
 * so this is a real narrowing, not a formality.
 */
async function assertCanEditBase(courseId: string, userId: string): Promise<Response | null> {
  const admin = createAdminClient();
  const access = await getTimetableAccess(admin, courseId, userId);
  if (access.canEditBase) return null;
  if (access.moderatedGroups.length > 0) {
    return new Response(
      "You moderate a group on this course, so you can adjust the sessions the course creator has opened for groups — but not the shared agenda itself.",
      { status: 403 },
    );
  }
  return new Response("Forbidden", { status: 403 });
}

const entrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  title: z.string().min(1).max(300),
  location: z.string().min(1).max(300),
  location_type: z.enum(["online", "in_person"]).default("online"),
  description: z.string().max(2000).nullable().optional(),
  // ADR-0005: the creator's tick marking a slot open to group moderators.
  // Optional so a client that predates group_timetables.sql still validates.
  moderator_adjustable: z.boolean().optional(),
});

async function notifyEnrolled(
  admin: ReturnType<typeof createAdminClient>,
  courseId: string,
  courseTitle: string,
  announcementTitle: string,
  announcementBody: string,
  authorId: string,
) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dasavandir.org";

  // Create announcement
  const { data: announcement } = await admin
    .from("announcements")
    .insert({ course_id: courseId, author_id: authorId, title: announcementTitle, body: announcementBody })
    .select("id")
    .single();

  const announcementsUrl = `${siteUrl}/learn/courses/${courseId}/announcements`;

  // Notify all enrolled learners
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
        courseTitle,
        announcementsUrl,
      }).catch((err) => console.error("[timetable/email]", err));
    }
  }

  return announcement?.id;
}

function formatEntryBody(entry: {
  date: string;
  start_time: string;
  end_time?: string | null;
  title: string;
  location: string;
  location_type: string;
  description?: string | null;
}): string {
  const dateStr = new Date(entry.date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const timeStr = entry.end_time
    ? `${entry.start_time.slice(0, 5)} – ${entry.end_time.slice(0, 5)}`
    : entry.start_time.slice(0, 5);
  const locationLabel = entry.location_type === "online" ? `Online: ${entry.location}` : `Location: ${entry.location}`;
  const parts = [`📅 ${dateStr}`, `🕐 ${timeStr}`, `📍 ${locationLabel}`];
  if (entry.description) parts.push(`\n${entry.description}`);
  return parts.join("\n");
}

// GET /api/admin/courses/[id]/timetable — list all entries for this course
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const ownerErr = await assertCourseOwner(params.id, user.id);
  if (ownerErr) return ownerErr;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("timetable_entries")
    .select("*")
    .eq("course_id", params.id)
    .order("date")
    .order("start_time");

  if (error) return new Response(error.message, { status: 500 });
  return Response.json(data);
}

// POST /api/admin/courses/[id]/timetable — create entry
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const ownerErr = await assertCanEditBase(params.id, user.id);
  if (ownerErr) return ownerErr;

  const body = await req.json();
  const { announce, ...entryData } = body;
  const parsed = entrySchema.safeParse(entryData);
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const admin = createAdminClient();
  const { data: course } = await admin.from("courses").select("title").eq("id", params.id).single();

  const { data: entry, error } = await admin
    .from("timetable_entries")
    .insert({ ...parsed.data, course_id: params.id })
    .select()
    .single();

  if (error) return new Response(error.message, { status: 500 });

  if (announce) {
    const announcementTitle = `📅 Schedule update: ${entry.title}`;
    const announcementBody = formatEntryBody(entry);
    await notifyEnrolled(admin, params.id, course?.title ?? "", announcementTitle, announcementBody, user.id);
  }

  return Response.json(entry, { status: 201 });
}

// PUT /api/admin/courses/[id]/timetable — update entry
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const ownerErr = await assertCanEditBase(params.id, user.id);
  if (ownerErr) return ownerErr;

  const body = await req.json();
  const { id: entryId, announce, ...rest } = body;
  if (!entryId) return new Response("Missing entry id", { status: 400 });

  const parsed = entrySchema.safeParse(rest);
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const admin = createAdminClient();
  const { data: course } = await admin.from("courses").select("title").eq("id", params.id).single();

  const { data: entry, error } = await admin
    .from("timetable_entries")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", entryId)
    .eq("course_id", params.id)
    .select()
    .single();

  if (error) return new Response(error.message, { status: 500 });

  if (announce) {
    const announcementTitle = `📅 Schedule updated: ${entry.title}`;
    const announcementBody = `The schedule has been updated.\n\n${formatEntryBody(entry)}`;
    await notifyEnrolled(admin, params.id, course?.title ?? "", announcementTitle, announcementBody, user.id);
  }

  return Response.json(entry);
}

// DELETE /api/admin/courses/[id]/timetable — delete entry
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const ownerErr = await assertCanEditBase(params.id, user.id);
  if (ownerErr) return ownerErr;

  const { id: entryId } = await req.json();
  if (!entryId) return new Response("Missing entry id", { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("timetable_entries")
    .delete()
    .eq("id", entryId)
    .eq("course_id", params.id);

  if (error) return new Response(error.message, { status: 500 });
  return new Response("OK");
}
