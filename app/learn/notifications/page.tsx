import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { MarkAllReadButton } from "./mark-all-read-button";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const supabase = createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: notifications } = await admin
    .from("notifications")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  // Mark all as read
  await admin.from("notifications").update({ read: true }).eq("user_id", user!.id).eq("read", false);

  const unread = (notifications ?? []).filter((n) => !n.read);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Notifications</h1>
        {(notifications ?? []).length > 0 && <MarkAllReadButton />}
      </div>

      {!(notifications ?? []).length && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">🔔</p>
          <p>No notifications yet.</p>
        </div>
      )}

      <div className="space-y-2">
        {(notifications ?? []).map((n) => (
          <div
            key={n.id}
            className={`rounded-xl border px-5 py-4 ${!n.read ? "bg-brand-50 border-brand-200" : "bg-white"}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium text-sm text-gray-900">{n.title}</p>
                {n.body && <p className="text-sm text-gray-500 mt-0.5">{n.body}</p>}
              </div>
              <span className="text-xs text-gray-400 shrink-0">
                {new Date(n.created_at).toLocaleDateString()}
              </span>
            </div>
            {n.link && (
              <Link href={n.link} className="text-xs text-brand-600 hover:underline mt-2 inline-block">
                View →
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
