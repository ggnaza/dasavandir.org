import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { createNotification } from "@/lib/notifications";
import { sendAnnouncementEmail } from "@/lib/email";
import { checkCourseAccess } from "@/lib/assert-course-owner";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "course_creator", "course_manager", "space_manager"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { course_id, title, body: announcementBody, cohort_only } = body;
  if (!course_id || !title?.trim() || !announcementBody?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Verify access to this specific course. checkCourseAccess is the single source
  // of truth for per-course scope: admin, the creator, course_creator_access,
  // course_manager_access, and space managers (course.space_id ∈ their managed
  // spaces). The previous inline creator/manager lookups omitted space_manager,
  // producing a spurious 403 for a space manager on a course in their own space.
  if ((await checkCourseAccess(course_id, user.id)) !== "ok") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // If cohort_only, tag announcement with this moderator's ID
  const target_moderator_id = (cohort_only && profile.role === "course_manager") ? user.id : null;

  const { data: announcement, error } = await admin
    .from("announcements")
    .insert({ course_id, title: title.trim(), body: announcementBody.trim(), author_id: user.id, target_moderator_id })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get course info and enrolled users — cohort_only limits recipients to assigned learners
  const [{ data: course }, { data: allEnrollments }] = await Promise.all([
    admin.from("courses").select("title").eq("id", course_id).single(),
    admin.from("enrollments").select("user_id").eq("course_id", course_id),
  ]);

  let targetUserIds = (allEnrollments ?? []).map((e) => e.user_id);
  if (target_moderator_id) {
    const { data: cohortRows } = await admin
      .from("moderator_cohort_assignments")
      .select("learner_id")
      .eq("moderator_id", target_moderator_id)
      .eq("course_id", course_id);
    const cohortSet = new Set((cohortRows ?? []).map((r) => r.learner_id));
    targetUserIds = targetUserIds.filter((id) => cohortSet.has(id));
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const announcementsUrl = `${siteUrl}/learn/announcements`;

  // Notify targeted users (fire-and-forget)
  for (const userId of targetUserIds) {
    const { data: authData } = await admin.auth.admin.getUserById(userId);
    const email = authData.user?.email;
    const fullName = authData.user?.user_metadata?.full_name ?? "";
    const firstName = fullName.split(" ")[0] || "";

    await Promise.allSettled([
      createNotification({
        user_id: userId,
        type: "announcement",
        title: `📢 ${title.trim()}`,
        body: `${course?.title ?? "Course"} · ${announcementBody.trim().slice(0, 100)}`,
        link: "/learn/announcements",
      }),
      email
        ? sendAnnouncementEmail({
            to: email,
            firstName,
            announcementTitle: title.trim(),
            announcementBody: announcementBody.trim(),
            courseTitle: course?.title ?? "Course",
            announcementsUrl,
          })
        : Promise.resolve(),
    ]);
  }

  return NextResponse.json({ id: announcement.id });
}
