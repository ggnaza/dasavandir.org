import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { checkCourseAccess } from "@/lib/assert-course-owner";

async function checkAccess(userId: string, announcementId: string, admin: ReturnType<typeof createAdminClient>) {
  const { data: announcement } = await admin
    .from("announcements")
    .select("id, course_id")
    .eq("id", announcementId)
    .single();

  if (!announcement) return null;

  // Enrolled learners may comment; so may course staff. checkCourseAccess covers
  // admin, the creator, course_creator_access, course_manager_access and space
  // managers (by course.space_id) — the inline creator/manager lookups this
  // replaced omitted space_manager, 403-ing them on their own space's course.
  const { data: enrollment } = await admin
    .from("enrollments")
    .select("id")
    .eq("user_id", userId)
    .eq("course_id", announcement.course_id)
    .maybeSingle();

  if (enrollment) return announcement;
  return (await checkCourseAccess(announcement.course_id, userId)) === "ok" ? announcement : null;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const announcement = await checkAccess(user.id, params.id, admin);
  if (!announcement) return NextResponse.json({ error: "Not found or forbidden" }, { status: 403 });

  const { body } = await req.json();
  if (!body?.trim()) return NextResponse.json({ error: "Body required" }, { status: 400 });

  const { data: comment, error } = await admin
    .from("announcement_comments")
    .insert({ announcement_id: params.id, user_id: user.id, body: body.trim() })
    .select("id, body, user_id, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch author name
  const { data: profile } = await admin.from("profiles").select("full_name").eq("id", user.id).single();

  return NextResponse.json({
    ...comment,
    author: profile?.full_name ?? "Unknown",
  });
}
