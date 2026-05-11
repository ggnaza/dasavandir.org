import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; commentId: string } }
) {
  const supabase = createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only delete own comment (or admin)
  const { data: comment } = await admin
    .from("announcement_comments")
    .select("id, user_id")
    .eq("id", params.commentId)
    .eq("announcement_id", params.id)
    .single();

  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (comment.user_id !== user.id && profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await admin.from("announcement_comments").delete().eq("id", params.commentId);
  return NextResponse.json({ ok: true });
}
