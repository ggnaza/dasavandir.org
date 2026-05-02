"use client";
import { useState, useEffect } from "react";

type Moderator = { manager_id: string; full_name: string | null; email: string | null; created_at: string };

export default function ModeratorsPage({ params }: { params: { id: string } }) {
  const [moderators, setModerators] = useState<Moderator[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadModerators() {
    const res = await fetch(`/api/admin/moderators?course_id=${params.id}`);
    if (res.ok) setModerators(await res.json());
  }

  useEffect(() => { loadModerators(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    setSuccess("");

    const res = await fetch("/api/admin/moderators", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", course_id: params.id, email: email.trim() }),
    });

    if (!res.ok) {
      setError(await res.text());
    } else {
      setSuccess("Moderator added!");
      setEmail("");
      loadModerators();
    }
    setLoading(false);
  }

  async function handleRemove(managerId: string) {
    if (!confirm("Remove this moderator?")) return;
    await fetch("/api/admin/moderators", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manager_id: managerId, course_id: params.id }),
    });
    loadModerators();
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Course Moderators</h2>
        <p className="text-sm text-gray-500 mt-1">
          Moderators can view student progress and submissions but cannot edit course content.
        </p>
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} className="bg-white border rounded-xl p-5 space-y-3">
        <p className="text-sm font-medium">Add moderator by email</p>
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="moderator@example.com"
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? "Adding…" : "Add"}
          </button>
        </div>
        {error && <p className="text-red-600 text-xs">{error}</p>}
        {success && <p className="text-green-600 text-xs">{success}</p>}
        <p className="text-xs text-gray-400">The user must already have an account on the platform.</p>
      </form>

      {/* Moderator list */}
      <div className="space-y-2">
        {moderators.length === 0 && (
          <p className="text-sm text-gray-400">No moderators yet.</p>
        )}
        {moderators.map((m) => (
          <div key={m.manager_id} className="bg-white border rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{m.full_name ?? m.email ?? "—"}</p>
              {m.email && m.full_name && <p className="text-xs text-gray-500">{m.email}</p>}
              <p className="text-xs text-gray-400">Added {new Date(m.created_at).toLocaleDateString()}</p>
            </div>
            <button
              onClick={() => handleRemove(m.manager_id)}
              className="text-xs text-red-500 hover:underline"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
