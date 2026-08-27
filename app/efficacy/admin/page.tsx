"use client";
import { useEffect, useState } from "react";

interface Assignment {
  id: string;
  ldm_id: string;
  teacher_id: string;
  ldm_name: string;
  teacher_name: string;
  ldm_email: string;
  teacher_email: string;
}

interface UsageStat {
  user_id: string;
  full_name: string;
  email: string;
  total_minutes: number;
  last_active: string;
}

export default function AdminPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [usage, setUsage] = useState<UsageStat[]>([]);
  const [ldmId, setLdmId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  function loadData() {
    setLoading(true);
    Promise.all([
      fetch("/api/efficacy/admin/assignments").then((r) => r.json()),
      fetch("/api/efficacy/admin/usage").then((r) => r.json()),
    ])
      .then(([a, u]) => {
        setAssignments(Array.isArray(a) ? a : []);
        setUsage(Array.isArray(u) ? u : []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadData(); }, []);

  async function handleAssign() {
    if (!ldmId || !teacherId) {
      setMessage({ type: "error", text: "Enter both LDM ID and Teacher ID" });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/efficacy/admin/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ldm_id: ldmId, teacher_id: teacherId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setMessage({ type: "success", text: "Assignment created" });
      setLdmId("");
      setTeacherId("");
      loadData();
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Failed" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/efficacy/admin/assignments?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed");
      }
      setAssignments((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Failed" });
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading...</div>;
  }

  // Group assignments by LDM
  const ldmGroups: Record<string, Assignment[]> = {};
  for (const a of assignments) {
    (ldmGroups[a.ldm_id] ??= []).push(a);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Efficacy Management</h1>
        <p className="text-gray-600 mt-1">Manage LDM-teacher assignments and view platform usage</p>
      </div>

      {message && (
        <div
          className={`p-3 rounded-lg text-sm ${
            message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">LDM-Teacher Assignments</h2>
        <div className="bg-white rounded-lg border p-4 mb-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">New Assignment</h3>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">LDM User ID</label>
              <input
                type="text"
                value={ldmId}
                onChange={(e) => setLdmId(e.target.value)}
                placeholder="UUID of LDM user"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Teacher User ID</label>
              <input
                type="text"
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
                placeholder="UUID of teacher user"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={handleAssign}
              disabled={saving}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {saving ? "..." : "Assign"}
            </button>
          </div>
        </div>

        {Object.keys(ldmGroups).length === 0 ? (
          <p className="text-gray-500 bg-white rounded-lg border p-6 text-center">
            No assignments yet
          </p>
        ) : (
          <div className="space-y-4">
            {Object.entries(ldmGroups).map(([_ldmId, group]) => (
              <div key={_ldmId} className="bg-white rounded-lg border p-4">
                <div className="font-medium text-gray-900 mb-2">
                  LDM: {group[0].ldm_name || group[0].ldm_email}
                </div>
                <div className="space-y-2">
                  {group.map((a) => (
                    <div key={a.id} className="flex items-center justify-between pl-4 text-sm">
                      <span className="text-gray-700">
                        {a.teacher_name || a.teacher_email}
                      </span>
                      <button
                        onClick={() => handleDelete(a.id)}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Platform Usage</h2>
        {usage.length === 0 ? (
          <p className="text-gray-500 bg-white rounded-lg border p-6 text-center">
            No usage data yet
          </p>
        ) : (
          <div className="bg-white rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">User</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Email</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">Total Minutes</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">Last Active</th>
                </tr>
              </thead>
              <tbody>
                {usage.map((u) => (
                  <tr key={u.user_id} className="border-b">
                    <td className="py-2 px-4 text-gray-900">{u.full_name || "-"}</td>
                    <td className="py-2 px-4 text-gray-500">{u.email}</td>
                    <td className="py-2 px-4 text-right text-gray-900">
                      {Math.round(u.total_minutes)}
                    </td>
                    <td className="py-2 px-4 text-right text-gray-500">
                      {u.last_active ? new Date(u.last_active).toLocaleDateString() : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
