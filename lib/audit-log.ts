import { createAdminClient } from "@/lib/supabase/admin";

type AuditAction =
  | "export_learners"
  | "review_submission"
  | "review_capstone"
  | "invite_users"
  | "delete_invitation";

export async function logAudit(
  action: AuditAction,
  actorId: string,
  req: Request,
  meta?: Record<string, unknown>
): Promise<void> {
  const admin = createAdminClient();
  await admin.from("audit_logs").insert({
    action,
    actor_id: actorId,
    ip: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip"),
    meta: meta ?? null,
    created_at: new Date().toISOString(),
  });
}
