import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { checkCourseAccess } from "@/lib/assert-course-owner";

const ALLOWED_EMOJIS = ["👍", "❤️", "🎉", "🙌", "💡"];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { emoji } = await req.json();
  if (!emoji || !ALLOWED_EMOJIS.includes(emoji)) {
    return NextResponse.json({ error: "Invalid emoji" }, { status: 400 });
  }

  // Check announcement exists and user has access
  const { data: announcement } = await admin
    .from("announcements")
    .select("id, course_id")
    .eq("id", params.id)
    .single();

  if (!announcement) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Enrolled learners may react; so may course staff. checkCourseAccess covers
  // admin, the creator, course_creator_access, course_manager_access and space
  // managers (by course.space_id) — the inline creator/manager lookups this
  // replaced omitted space_manager.
  const { data: enrollment } = await admin
    .from("enrollments")
    .select("id")
    .eq("user_id", user.id)
    .eq("course_id", announcement.course_id)
    .maybeSingle();

  const hasAccess = !!enrollment || (await checkCourseAccess(announcement.course_id, user.id)) === "ok";
  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Toggle: delete if exists, insert if not
  const { data: existing } = await admin
    .from("announcement_reactions")
    .select("id")
    .eq("announcement_id", params.id)
    .eq("user_id", user.id)
    .eq("emoji", emoji)
    .single();

  if (existing) {
    await admin.from("announcement_reactions").delete().eq("id", existing.id);
    return NextResponse.json({ action: "removed" });
  } else {
    await admin.from("announcement_reactions").insert({ announcement_id: params.id, user_id: user.id, emoji });
    return NextResponse.json({ action: "added" });
  }
}
