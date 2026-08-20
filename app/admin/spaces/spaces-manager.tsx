"use client";
import { useState } from "react";

type Space = { id: string; name: string; ord: number; courseCount: number };

export function SpacesManager({ initialSpaces }: { initialSpaces: Space[] }) {
  const [spaces, setSpaces] = useState<Space[]>(initialSpaces);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  async function errText(res: Response) {
    const d = await res.json().catch(() => ({}));
    return d.error ?? "Something went wrong";
  }

  async function addSpace(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await errText(res));
      return;
    }
    const { space } = await res.json();
    setSpaces((s) => [...s, { ...space, courseCount: 0 }]);
    setNewName("");
  }

  async function rename(id: string) {
    const name = editName.trim();
    if (!name) {
      setEditingId(null);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/spaces/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await errText(res));
      return;
    }
    setSpaces((s) => s.map((x) => (x.id === id ? { ...x, name } : x)));
    setEditingId(null);
  }

  async function remove(id: string) {
    if (!confirm("Delete this space? Any courses in it must be moved out first.")) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/spaces/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setError(await errText(res));
      return;
    }
    setSpaces((s) => s.filter((x) => x.id !== id));
  }

  return (
    <div className="max-w-2xl">
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <ul className="divide-y border rounded-xl bg-white">
        {spaces.length === 0 && (
          <li className="px-4 py-6 text-sm text-gray-500 text-center">No spaces yet — add one below.</li>
        )}
        {spaces.map((s) => (
          <li key={s.id} className="flex items-center gap-3 px-4 py-3">
            {editingId === s.id ? (
              <>
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void rename(s.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  onClick={() => void rename(s.id)}
                  disabled={busy}
                  className="text-sm bg-brand-600 text-white rounded-lg px-3 py-1.5 hover:bg-brand-700 disabled:opacity-50"
                >
                  Save
                </button>
                <button onClick={() => setEditingId(null)} className="text-sm text-gray-500 px-2">
                  Cancel
                </button>
              </>
            ) : (
              <>
                <div className="flex-1">
                  <span className="text-sm font-medium">{s.name}</span>
                  <span className="ml-2 text-xs text-gray-400">
                    {s.courseCount} course{s.courseCount === 1 ? "" : "s"}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setEditingId(s.id);
                    setEditName(s.name);
                  }}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Rename
                </button>
                <button
                  onClick={() => void remove(s.id)}
                  disabled={busy}
                  className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  Delete
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={addSpace} className="mt-4 flex items-center gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New space name (e.g. HR Onboarding)"
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button
          type="submit"
          disabled={busy || !newName.trim()}
          className="text-sm bg-brand-600 text-white rounded-lg px-4 py-2 hover:bg-brand-700 disabled:opacity-50"
        >
          Add space
        </button>
      </form>
    </div>
  );
}
