import { createAdminClient } from "@/lib/supabase/admin";

export type AuditAction =
  | "export_learners"
  | "review_submission"
  | "review_capstone"
  | "invite_users"
  | "delete_invitation"
  | "create_user"
  | "update_role"
  | "delete_user"
  | "login"
  | "login_failed"
  | "lesson_edit_open"
  | "lesson_edit_save"
  | "bulk_enroll"
  | "bulk_unenroll"
  | "bulk_delete_users"
  | "delete_course"
  | "unenroll_learner"
  | "reassign_review";

export async function logAudit(
  action: AuditAction,
  actorId: string | null,
  req: Request,
  meta?: Record<string, unknown>
): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("audit_logs").insert({
      action,
      actor_id: actorId,
      ip: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip"),
      meta: meta ?? null,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    // Never let audit logging crash the request
    console.error("[audit-log]", err);
  }
}
