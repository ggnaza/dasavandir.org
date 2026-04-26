import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { logAudit } from "@/lib/audit-log";
import { z } from "zod";

const inviteSchema = z.object({
  courseId: z.string().uuid(),
  emails: z.array(z.string().email()).min(1).max(200),
});

const deleteSchema = z.object({
  id: z.string().uuid(),
});

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!profile) return new Response("Unauthorized", { status: 401 });
  if (profile.role !== "admin") return new Response("Forbidden", { status: 403 });

  const parsed = inviteSchema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });
  const { courseId, emails } = parsed.data;

  const ownerErr = await assertCourseOwner(courseId, user.id);
  if (ownerErr) return ownerErr;

  const clean = emails.map((e) => e.trim().toLowerCase());

  const rows = clean.map((email) => ({
    course_id: courseId,
    email,
    invited_by: user.id,
  }));

  await admin
    .from("invitations")
    .upsert(rows, { onConflict: "course_id,email", ignoreDuplicates: true });

  await logAudit("invite_users", user.id, req, { course_id: courseId, count: clean.length });

  return Response.json({ invited: clean.length });
}

export async function DELETE(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!profile) return new Response("Unauthorized", { status: 401 });
  if (profile.role !== "admin") return new Response("Forbidden", { status: 403 });

  const parsed = deleteSchema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });
  const { id } = parsed.data;

  const { data: invitation } = await admin
    .from("invitations")
    .select("course_id")
    .eq("id", id)
    .single();

  if (!invitation) return new Response("Not found", { status: 404 });

  const ownerErr = await assertCourseOwner(invitation.course_id, user.id);
  if (ownerErr) return ownerErr;

  await admin.from("invitations").delete().eq("id", id);

  await logAudit("delete_invitation", user.id, req, { invitation_id: id, course_id: invitation.course_id });

  return new Response("ok");
}
