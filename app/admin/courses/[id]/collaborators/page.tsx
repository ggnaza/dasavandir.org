"use client";
import { useState, useEffect } from "react";

type Collaborator = {
  creator_id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
};

export default function CollaboratorsPage({ params }: { params: { id: string } }) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    const [collabRes, meRes] = await Promise.all([
      fetch(`/api/admin/collaborators?course_id=${params.id}`),
      fetch("/api/admin/me"),
    ]);
    if (collabRes.ok) setCollaborators(await collabRes.json());
    if (meRes.ok) {
      const me = await meRes.json();
      setIsAdmin(me.role === "admin");
    }
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    setSuccess("");
    const res = await fetch("/api/admin/collaborators", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ course_id: params.id, email: email.trim() }),
    });
    if (!res.ok) {
      setError(await res.text());
    } else {
      setSuccess("Collaborator added.");
      setEmail("");
      load();
    }
    setLoading(false);
  }

  async function handleRemove(creatorId: string) {
    if (!confirm("Remove this collaborator?")) return;
    await fetch("/api/admin/collaborators", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creator_id: creatorId, course_id: params.id }),
    });
    load();
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Course Collaborators</h2>
        <p className="text-sm text-gray-500 mt-1">
          Collaborators are course creators who can edit this course's content and lessons.
        </p>
      </div>

      {isAdmin && (
        <form onSubmit={handleAdd} className="bg-white border rounded-xl p-5 space-y-3">
          <p className="text-sm font-medium">Add collaborator by email</p>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="creator@example.com"
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
          <p className="text-xs text-gray-400">The user must have a course_creator role.</p>
        </form>
      )}

      <div className="space-y-2">
        {collaborators.length === 0 && (
          <p className="text-sm text-gray-400">No collaborators yet.</p>
        )}
        {collaborators.map((c) => (
          <div key={c.creator_id} className="bg-white border rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{c.full_name ?? c.email ?? "—"}</p>
              {c.email && c.full_name && <p className="text-xs text-gray-500">{c.email}</p>}
              <p className="text-xs text-gray-400">Added {new Date(c.created_at).toLocaleDateString()}</p>
            </div>
            {isAdmin && (
              <button
                onClick={() => handleRemove(c.creator_id)}
                className="text-xs text-red-500 hover:underline"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
