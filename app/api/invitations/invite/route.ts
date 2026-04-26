import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCourseOwner } from "@/lib/assert-course-owner";

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return new Response("Forbidden", { status: 403 });

  const { courseId, emails } = await req.json();
  if (!courseId || !Array.isArray(emails) || emails.length === 0) {
    return new Response("Missing courseId or emails", { status: 400 });
  }

  const ownerErr = await assertCourseOwner(courseId, user.id);
  if (ownerErr) return ownerErr;

  const clean = emails
    .map((e: string) => e.trim().toLowerCase())
    .filter((e: string) => e.includes("@"));

  if (clean.length === 0) return new Response("No valid emails", { status: 400 });

  const rows = clean.map((email: string) => ({
    course_id: courseId,
    email,
    invited_by: user.id,
  }));

  await admin
    .from("invitations")
    .upsert(rows, { onConflict: "course_id,email", ignoreDuplicates: true });

  return Response.json({ invited: clean.length });
}

export async function DELETE(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return new Response("Forbidden", { status: 403 });

  const { id } = await req.json();

  const { data: invitation } = await admin
    .from("invitations")
    .select("course_id")
    .eq("id", id)
    .single();

  if (!invitation) return new Response("Not found", { status: 404 });

  const ownerErr = await assertCourseOwner(invitation.course_id, user.id);
  if (ownerErr) return ownerErr;

  await admin.from("invitations").delete().eq("id", id);
  return new Response("ok");
}
