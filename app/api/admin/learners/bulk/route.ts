import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit-log";
import { z } from "zod";

const enrollSchema = z.object({
  action: z.literal("enroll"),
  userIds: z.array(z.string().uuid()).min(1).max(200),
  courseId: z.string().uuid(),
});

const deleteSchema = z.object({
  action: z.literal("delete"),
  userIds: z.array(z.string().uuid()).min(1).max(200),
});

const unenrollSchema = z.object({
  action: z.literal("unenroll"),
  userIds: z.array(z.string().uuid()).min(1).max(200),
  courseId: z.string().uuid(),
});

const schema = z.discriminatedUnion("action", [enrollSchema, deleteSchema, unenrollSchema]);

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return new Response(JSON.stringify({ error: "Invalid input" }), { status: 400 });

  const body = parsed.data;

  if (body.action === "enroll") {
    const rows = body.userIds.map((uid) => ({ user_id: uid, course_id: body.courseId }));
    const { error } = await admin.from("enrollments").upsert(rows, { onConflict: "user_id,course_id" });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    await logAudit("bulk_enroll", user.id, req, { course_id: body.courseId, count: body.userIds.length });
    return Response.json({ success: true, count: body.userIds.length });
  }

  if (body.action === "unenroll") {
    const { error } = await admin
      .from("enrollments")
      .delete()
      .in("user_id", body.userIds)
      .eq("course_id", body.courseId);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    await logAudit("bulk_unenroll", user.id, req, { course_id: body.courseId, count: body.userIds.length });
    return Response.json({ success: true, count: body.userIds.length });
  }

  if (body.action === "delete") {
    if (body.userIds.includes(user.id)) {
      return new Response(JSON.stringify({ error: "Cannot delete your own account." }), { status: 400 });
    }
    const errors: string[] = [];
    for (const uid of body.userIds) {
      const { error } = await admin.auth.admin.deleteUser(uid);
      if (error) errors.push(uid);
    }
    await logAudit("bulk_delete_users", user.id, req, { count: body.userIds.length - errors.length });
    if (errors.length > 0) {
      return Response.json({ success: false, failed: errors }, { status: 207 });
    }
    return Response.json({ success: true, count: body.userIds.length });
  }
}
