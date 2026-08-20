"use client";
import { useEffect, useState } from "react";

type Space = { id: string; name: string };

export function ManageSpacesModal({
  userId,
  userName,
  onClose,
}: {
  userId: string | null;
  userName: string;
  onClose: () => void;
}) {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [memberOf, setMemberOf] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      fetch("/api/admin/spaces").then((r) => r.json()),
      fetch(`/api/admin/space-members?userId=${userId}`).then((r) => r.json()),
    ])
      .then(([s, m]) => {
        setSpaces(s.spaces ?? []);
        setMemberOf(new Set((m.spaceIds ?? []) as string[]));
      })
      .catch(() => setError("Failed to load spaces"))
      .finally(() => setLoading(false));
  }, [userId]);

  if (!userId) return null;

  async function toggle(spaceId: string, isMember: boolean) {
    if (!userId) return;
    setBusyId(spaceId);
    setError(null);
    const res = isMember
      ? await fetch(`/api/admin/space-members?userId=${userId}&spaceId=${spaceId}`, { method: "DELETE" })
      : await fetch("/api/admin/space-members", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, spaceId }),
        });
    setBusyId(null);
    if (!res.ok) {
      setError("Update failed");
      return;
    }
    setMemberOf((prev) => {
      const next = new Set(prev);
      if (isMember) next.delete(spaceId);
      else next.add(spaceId);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-1">Spaces</h2>
        <p className="text-sm text-gray-500 mb-4">
          Which spaces <span className="font-medium text-gray-700">{userName}</span> belongs to. A learner
          sees the courses in the spaces they belong to.
        </p>
        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : (
          <ul className="space-y-2">
            {spaces.length === 0 && <li className="text-sm text-gray-500">No spaces yet.</li>}
            {spaces.map((s) => {
              const isMember = memberOf.has(s.id);
              return (
                <li key={s.id}>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isMember}
                      disabled={busyId === s.id}
                      onChange={() => void toggle(s.id, isMember)}
                      className="w-4 h-4"
                    />
                    {s.name}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="text-sm bg-gray-100 rounded-lg px-4 py-2 hover:bg-gray-200">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
