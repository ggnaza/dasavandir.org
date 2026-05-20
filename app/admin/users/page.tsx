"use client";

import { useEffect, useState, useCallback } from "react";
import { UserRoleToggle } from "./user-role-toggle";
import { AddUserModal } from "./add-user-modal";
import { DeleteUserDialog } from "./delete-user-dialog";
import { AssignCoursesModal } from "./assign-courses-modal";
import Link from "next/link";

type User = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  status: string | null;
  created_at: string;
};

const PAGE_SIZE = 50;

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deleteUserName, setDeleteUserName] = useState("");
  const [assignCreatorId, setAssignCreatorId] = useState<string | null>(null);
  const [assignCreatorName, setAssignCreatorName] = useState("");
  const [resending, setResending] = useState<string | null>(null);

  const fetchUsers = useCallback(async (p: number = page, s: string = search) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), search: s });
      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json();
      setUsers(data.users || []);
      setTotal(data.total ?? 0);
    } catch (err) {
      console.error("Failed to fetch users", err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchUsers(page, search); }, [page, search]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  }

  const resendInvite = async (userId: string) => {
    setResending(userId);
    try {
      await fetch("/api/admin/users/resend-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
    } finally {
      setResending(null);
    }
  };

  const roleColors: Record<string, string> = {
    admin: "bg-red-100 text-red-800",
    course_creator: "bg-blue-100 text-blue-800",
    course_manager: "bg-purple-100 text-purple-800",
    learner: "bg-gray-100 text-gray-800",
  };

  const roleLabels: Record<string, string> = {
    admin: "Admin",
    course_creator: "Course Creator",
    course_manager: "Course Manager",
    learner: "Learner",
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Users & Roles</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + Add User
        </button>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by name or email…"
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button type="submit" className="bg-gray-100 border rounded-lg px-4 py-2 text-sm hover:bg-gray-200">
          Search
        </button>
        {search && (
          <button
            type="button"
            onClick={() => { setSearchInput(""); setSearch(""); setPage(1); }}
            className="text-sm text-gray-500 hover:underline px-2"
          >
            Clear
          </button>
        )}
      </form>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading users...</div>
      ) : (
        <>
          <div className="bg-white border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-700">Name</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-700">Role</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-700">Status</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-700">Joined</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((user) => {
                  const isPending = user.status === "pending";
                  return (
                    <tr key={user.id} className={`hover:bg-gray-50 ${isPending ? "bg-amber-50/40" : ""}`}>
                      <td className="px-6 py-4 text-sm">
                        <div className="font-medium text-gray-900">{user.full_name || "—"}</div>
                        {user.email && <div className="text-gray-400 text-xs mt-0.5">{user.email}</div>}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${roleColors[user.role] ?? "bg-gray-100 text-gray-800"}`}>
                          {roleLabels[user.role] ?? user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {isPending ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                            Not activated
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isPending ? (
                            <button
                              onClick={() => resendInvite(user.id)}
                              disabled={resending === user.id}
                              className="text-amber-600 hover:underline text-sm disabled:opacity-50"
                            >
                              {resending === user.id ? "Sending…" : "Resend invite"}
                            </button>
                          ) : (
                            <>
                              <UserRoleToggle userId={user.id} currentRole={user.role} onUpdate={() => fetchUsers(page, search)} />
                              <Link href={`/admin/users/${user.id}/activity`} className="text-blue-600 hover:underline text-sm">
                                Activity
                              </Link>
                              {user.role === "course_creator" && (
                                <button
                                  onClick={() => { setAssignCreatorId(user.id); setAssignCreatorName(user.full_name || "User"); }}
                                  className="text-blue-600 hover:underline text-sm"
                                >
                                  Courses
                                </button>
                              )}
                            </>
                          )}
                          <button
                            onClick={() => { setDeleteUserId(user.id); setDeleteUserName(user.full_name || "User"); }}
                            className="text-red-600 hover:underline text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-400">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} users
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="text-sm border rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40"
                >
                  ← Previous
                </button>
                <span className="text-sm text-gray-500 self-center">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="text-sm border rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <AddUserModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onSuccess={() => fetchUsers(1, search)} />
      <AssignCoursesModal
        creatorId={assignCreatorId || ""}
        creatorName={assignCreatorName}
        isOpen={!!assignCreatorId}
        onClose={() => setAssignCreatorId(null)}
      />
      <DeleteUserDialog
        userId={deleteUserId || ""}
        userName={deleteUserName}
        isOpen={!!deleteUserId}
        onClose={() => setDeleteUserId(null)}
        onSuccess={() => fetchUsers(page, search)}
      />
    </div>
  );
}
