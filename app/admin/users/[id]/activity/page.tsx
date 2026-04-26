import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function UserActivityPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const admin = createAdminClient();

  const { data: currentUser } = await supabase.auth.getUser();
  if (!currentUser) return <div>Unauthorized</div>;

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", currentUser.user?.id)
    .single();

  if (currentProfile?.role !== "admin") {
    return <div>Unauthorized</div>;
  }

  const { data: user } = await admin
    .from("profiles")
    .select("full_name, role, created_at")
    .eq("id", params.id)
    .single();

  const { data: logs } = await admin
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, details, created_at")
    .eq("user_id", params.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const actionLabels: Record<string, string> = {
    update_role: "Updated user role",
    create_course: "Created course",
    publish_course: "Published course",
    login: "Logged in",
  };

  return (
    <div>
      <div className="mb-8">
        <Link href="/admin/users" className="text-blue-600 hover:underline text-sm mb-4 inline-block">
          ← Back to Users
        </Link>
        <h1 className="text-2xl font-bold">{user?.full_name || "User"} - Activity Log</h1>
        <p className="text-gray-600 text-sm mt-1">
          Role: <span className="font-medium">{user?.role}</span> • Joined:{" "}
          <span className="font-medium">{new Date(user?.created_at || "").toLocaleDateString()}</span>
        </p>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        {logs && logs.length > 0 ? (
          <div className="divide-y">
            {logs.map((log) => (
              <div key={log.id} className="p-6 hover:bg-gray-50 transition">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{actionLabels[log.action] || log.action}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {log.entity_type && <span className="capitalize">{log.entity_type}</span>}
                    </p>
                    {log.details && (
                      <p className="text-xs text-gray-500 mt-2 bg-gray-50 rounded p-2">
                        {JSON.stringify(log.details, null, 2)}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-gray-500">No activity recorded</div>
        )}
      </div>
    </div>
  );
}
