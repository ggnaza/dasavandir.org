import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UserRoleToggle } from "./user-role-toggle";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const supabase = createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <div>Unauthorized</div>;

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") {
    return <div>Unauthorized</div>;
  }

  const { data: users } = await admin
    .from("profiles")
    .select("id, full_name, role, created_at")
    .order("created_at", { ascending: false });

  const roleColors: Record<string, string> = {
    admin: "bg-red-100 text-red-800",
    course_creator: "bg-blue-100 text-blue-800",
    learner: "bg-gray-100 text-gray-800",
  };

  const roleLabels: Record<string, string> = {
    admin: "Admin",
    course_creator: "Course Creator",
    learner: "Learner",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Users & Roles</h1>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-700">Name</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-700">Role</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-700">Joined</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users?.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{user.full_name || "—"}</td>
                <td className="px-6 py-4 text-sm">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${roleColors[user.role]}`}>
                    {roleLabels[user.role]}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-sm">
                  <div className="flex items-center gap-2">
                    <UserRoleToggle userId={user.id} currentRole={user.role} />
                    <Link
                      href={`/admin/users/${user.id}/activity`}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Activity
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
