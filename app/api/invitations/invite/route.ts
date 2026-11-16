import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { logAudit } from "@/lib/audit-log";
import { invitationEmail, sendEmailBatch } from "@/lib/email";
import type { BatchResult } from "@/lib/email-batch";
import { z } from "zod";

const studentSchema = z.object({
  email: z.string().email(),
  firstName: z.string().optional().default(""),
  lastName: z.string().optional().default(""),
});

const inviteSchema = z.object({
  courseId: z.string().uuid(),
  students: z.array(studentSchema).min(1).max(200).optional(),
  emails: z.array(z.string().email()).min(1).max(200).optional(),
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
  // Coarse role pre-filter. The authoritative per-course check is assertCourseOwner
  // below (via checkCourseAccess) — keep this list in sync with the roles it grants,
  // which includes space_manager. Omitting a role here blocks it before the real
  // check ever runs (this dropped space_manager and produced spurious "Forbidden").
  if (
    profile.role !== "admin" &&
    profile.role !== "course_creator" &&
    profile.role !== "course_manager" &&
    profile.role !== "space_manager"
  ) {
    return new Response("Forbidden", { status: 403 });
  }

  const parsed = inviteSchema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });
  const { courseId, students, emails } = parsed.data;

  const ownerErr = await assertCourseOwner(courseId, user.id);
  if (ownerErr) return ownerErr;

  const studentList = students
    ? students.map((s) => ({ ...s, email: s.email.trim().toLowerCase() }))
    : (emails ?? []).map((e) => ({ email: e.trim().toLowerCase(), firstName: "", lastName: "" }));

  const { data: course } = await admin
    .from("courses")
    .select("title")
    .eq("id", courseId)
    .single();

  const rows = studentList.map(({ email, firstName, lastName }) => ({
    course_id: courseId,
    email,
    first_name: firstName || null,
    last_name: lastName || null,
    invited_by: user.id,
  }));

  await admin
    .from("invitations")
    .upsert(rows, { onConflict: "course_id,email", ignoreDuplicates: true });

  let emailResult: BatchResult | null = null;
  if (course) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const signupUrl = `${siteUrl}/auth/signup`;

    emailResult = await sendEmailBatch(
      studentList.map(({ email, firstName }) =>
        invitationEmail({ to: email, firstName, courseTitle: course.title, signupUrl })
      )
    );
    if (emailResult.failed.length) console.error("[invite] Resend errors:", emailResult.failed);
  }

  await logAudit("invite_users", user.id, req, {
    course_id: courseId,
    count: studentList.length,
    emails_sent: emailResult?.sent ?? 0,
    emails_failed: emailResult?.failed.length ?? 0,
  });

  return Response.json({
    invited: studentList.length,
    emailsSent: emailResult?.sent ?? 0,
    emailFailures: emailResult?.failed.map((f) => f.to) ?? [],
  });
}

export async function DELETE(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!profile) return new Response("Unauthorized", { status: 401 });
  // Coarse pre-filter — keep in sync with checkCourseAccess (assertCourseOwner
  // below), which grants space_manager. See the POST handler note above.
  if (
    profile.role !== "admin" &&
    profile.role !== "course_creator" &&
    profile.role !== "course_manager" &&
    profile.role !== "space_manager"
  ) {
    return new Response("Forbidden", { status: 403 });
  }

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
