"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Learner = { id: string; full_name: string | null; email: string };

export function EnrollLearnersButton({ courseId, enrolledIds }: { courseId: string; enrolledIds: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="border rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 text-gray-700"
      >
        Enroll existing users
      </button>
      {open && (
        <EnrollModal courseId={courseId} enrolledIds={enrolledIds} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function EnrollModal({
  courseId,
  enrolledIds,
  onClose,
}: {
  courseId: string;
  enrolledIds: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [learners, setLearners] = useState<Learner[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/learners")
      .then((r) => r.json())
      .then((d) => {
        const all: Learner[] = (d.learners ?? []).map((l: any) => ({
          id: l.id,
          full_name: l.full_name,
          email: l.email,
        }));
        setLearners(all.filter((l) => !enrolledIds.includes(l.id)));
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = learners.filter((l) => {
    const q = search.toLowerCase();
    return !q || l.full_name?.toLowerCase().includes(q) || l.email.toLowerCase().includes(q);
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((l) => l.id)));
    }
  }

  async function handleEnroll() {
    if (selected.size === 0) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/learners/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "enroll", courseId, userIds: Array.from(selected) }),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? "Failed to enroll.");
      setSaving(false);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-bold">Enroll existing users</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="p-4 border-b">
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="overflow-y-auto flex-1">
          {loading ? (
            <p className="text-center py-8 text-gray-400 text-sm">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-center py-8 text-gray-400 text-sm">
              {learners.length === 0 ? "All users are already enrolled." : "No users match your search."}
            </p>
          ) : (
            <>
              <div
                className="flex items-center gap-3 px-5 py-3 border-b bg-gray-50 cursor-pointer hover:bg-gray-100"
                onClick={toggleAll}
              >
                <input
                  type="checkbox"
                  readOnly
                  checked={selected.size === filtered.length && filtered.length > 0}
                  className="w-4 h-4"
                />
                <span className="text-xs font-semibold text-gray-600">
                  {selected.size > 0 ? `${selected.size} selected` : "Select all"}
                </span>
              </div>
              {filtered.map((l) => (
                <div
                  key={l.id}
                  onClick={() => toggle(l.id)}
                  className="flex items-center gap-3 px-5 py-3 border-b cursor-pointer hover:bg-gray-50"
                >
                  <input type="checkbox" readOnly checked={selected.has(l.id)} className="w-4 h-4" />
                  <div>
                    <p className="text-sm font-medium">{l.full_name || l.email}</p>
                    {l.full_name && <p className="text-xs text-gray-400">{l.email}</p>}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="p-4 border-t flex items-center justify-between gap-3">
          {error && <p className="text-red-600 text-xs">{error}</p>}
          <div className="flex gap-2 ml-auto">
            <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button
              onClick={handleEnroll}
              disabled={selected.size === 0 || saving}
              className="bg-brand-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? "Enrolling…" : `Enroll ${selected.size > 0 ? selected.size : ""} learner${selected.size !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
