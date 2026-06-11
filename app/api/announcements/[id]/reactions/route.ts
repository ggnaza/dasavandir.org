import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

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

  // Check enrollment or creator/manager/admin access
  const [{ data: enrollment }, { data: creatorAccess }, { data: managerAccess }, { data: profile }] = await Promise.all([
    admin.from("enrollments").select("id").eq("user_id", user.id).eq("course_id", announcement.course_id).single(),
    admin.from("course_creator_access").select("id").eq("creator_id", user.id).eq("course_id", announcement.course_id).single(),
    admin.from("course_manager_access").select("id").eq("manager_id", user.id).eq("course_id", announcement.course_id).single(),
    admin.from("profiles").select("role").eq("id", user.id).single(),
  ]);

  const hasAccess = enrollment || creatorAccess || managerAccess || profile?.role === "admin";
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
