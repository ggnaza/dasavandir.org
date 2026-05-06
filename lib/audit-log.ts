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
  | "login_failed";

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
