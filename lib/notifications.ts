import { createAdminClient } from "@/lib/supabase/admin";

interface NotificationPayload {
  user_id: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
}

export async function createNotification(payload: NotificationPayload) {
  const admin = createAdminClient();
  await admin.from("notifications").insert(payload);
}
