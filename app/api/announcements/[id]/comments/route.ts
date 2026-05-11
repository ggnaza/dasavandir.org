import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

async function checkAccess(userId: string, announcementId: string, admin: ReturnType<typeof createAdminClient>) {
  const { data: announcement } = await admin
    .from("announcements")
    .select("id, course_id")
    .eq("id", announcementId)
    .single();

  if (!announcement) return null;

  const [{ data: enrollment }, { data: creatorAccess }, { data: profile }] = await Promise.all([
    admin.from("enrollments").select("id").eq("user_id", userId).eq("course_id", announcement.course_id).single(),
    admin.from("course_creator_access").select("id").eq("creator_id", userId).eq("course_id", announcement.course_id).single(),
    admin.from("profiles").select("role").eq("id", userId).single(),
  ]);

  return enrollment || creatorAccess || profile?.role === "admin" ? announcement : null;
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
