"use client";

import { useEffect, useState } from "react";
import { UserRoleToggle } from "./user-role-toggle";
import { AddUserModal } from "./add-user-modal";
import { DeleteUserDialog } from "./delete-user-dialog";
import Link from "next/link";

type User = {
  id: string;
  full_name: string;
  role: string;
  created_at: string;
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deleteUserName, setDeleteUserName] = useState("");

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users/list");
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error("Failed to fetch users", err);
    } finally {
      setLoading(false);
    }
  };

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
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + Add User
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading users...</div>
      ) : (
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
              {users.map((user) => (
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
                      <UserRoleToggle userId={user.id} currentRole={user.role} onUpdate={fetchUsers} />
                      <Link
                        href={`/admin/users/${user.id}/activity`}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        Activity
                      </Link>
                      <button
                        onClick={() => {
                          setDeleteUserId(user.id);
                          setDeleteUserName(user.full_name || "User");
                        }}
                        className="text-red-600 hover:underline text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddUserModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onSuccess={fetchUsers} />
      <DeleteUserDialog
        userId={deleteUserId || ""}
        userName={deleteUserName}
        isOpen={!!deleteUserId}
        onClose={() => setDeleteUserId(null)}
        onSuccess={fetchUsers}
      />
    </div>
  );
}
