"use client";
import { useState, useEffect } from "react";

type Moderator = { manager_id: string; full_name: string | null; email: string | null; created_at: string };
type Learner = { userId: string; name: string; email: string };
type Assignment = { moderator_id: string; learner_id: string };

export default function ModeratorsPage({ params }: { params: { id: string } }) {
  const courseId = params.id;
  const [moderators, setModerators] = useState<Moderator[]>([]);
  const [learners, setLearners] = useState<Learner[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingSelections, setPendingSelections] = useState<Record<string, Set<string>>>({});

  async function loadAll() {
    const [modRes, assignRes] = await Promise.all([
      fetch(`/api/admin/moderators?course_id=${courseId}`),
      fetch(`/api/admin/moderators/assignments?course_id=${courseId}`),
    ]);
    if (modRes.ok) setModerators(await modRes.json());
    if (assignRes.ok) {
      const data: Assignment[] = await assignRes.json();
      setAssignments(data);
      // Initialise pending selections from current assignments
      const byMod: Record<string, Set<string>> = {};
      for (const a of data) {
        if (!byMod[a.moderator_id]) byMod[a.moderator_id] = new Set();
        byMod[a.moderator_id].add(a.learner_id);
      }
      setPendingSelections(byMod);
    }
  }

  async function loadLearners() {
    // Fetch enrolled learner profiles for this course via the learners page data
    const res = await fetch(`/api/admin/courses/${courseId}/enrolled-learners`);
    if (res.ok) setLearners(await res.json());
  }

  useEffect(() => { loadAll(); loadLearners(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true); setError(""); setSuccess("");
    const res = await fetch("/api/admin/moderators", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", course_id: courseId, email: email.trim() }),
    });
    if (!res.ok) { setError(await res.text()); } else { setSuccess("Moderator added!"); setEmail(""); loadAll(); }
    setLoading(false);
  }

  async function handleRemove(managerId: string) {
    if (!confirm("Remove this moderator?")) return;
    await fetch("/api/admin/moderators", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manager_id: managerId, course_id: courseId }),
    });
    loadAll();
  }

  function toggleLearner(moderatorId: string, learnerId: string) {
    setPendingSelections((prev) => {
      const set = new Set(prev[moderatorId] ?? []);
      if (set.has(learnerId)) set.delete(learnerId); else set.add(learnerId);
      return { ...prev, [moderatorId]: set };
    });
  }

  async function saveAssignments(moderatorId: string) {
    setSaving(true);
    const desired = pendingSelections[moderatorId] ?? new Set<string>();
    const current = new Set(assignments.filter((a) => a.moderator_id === moderatorId).map((a) => a.learner_id));

    const toAdd = Array.from(desired).filter((id) => !current.has(id));
    const toRemove = Array.from(current).filter((id) => !desired.has(id));

    await Promise.all([
      toAdd.length > 0
        ? fetch("/api/admin/moderators/assignments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ course_id: courseId, moderator_id: moderatorId, learner_ids: toAdd }),
          })
        : Promise.resolve(),
      ...toRemove.map((learner_id) =>
        fetch("/api/admin/moderators/assignments", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ course_id: courseId, moderator_id: moderatorId, learner_id }),
        })
      ),
    ]);

    await loadAll();
    setSaving(false);
  }

  const assignedCount = (moderatorId: string) =>
    assignments.filter((a) => a.moderator_id === moderatorId).length;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Course Moderators</h2>
        <p className="text-sm text-gray-500 mt-1">
          Moderators can view progress and submissions only for the learners they're responsible for — the
          members of groups they moderate, plus anyone you assign below. A moderator with no groups and no
          assigned learners sees no one until you scope them.
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
          <button type="submit" disabled={loading || !email.trim()} className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
            {loading ? "Adding…" : "Add"}
          </button>
        </div>
        {error && <p className="text-red-600 text-xs">{error}</p>}
        {success && <p className="text-green-600 text-xs">{success}</p>}
        <p className="text-xs text-gray-400">The user must already have an account on the platform.</p>
      </form>

      {/* Moderator list with cohort assignment */}
      <div className="space-y-3">
        {moderators.length === 0 && <p className="text-sm text-gray-400">No moderators yet.</p>}
        {moderators.map((m) => {
          const count = assignedCount(m.manager_id);
          const isExpanded = expandedId === m.manager_id;
          const pending = pendingSelections[m.manager_id] ?? new Set<string>();

          return (
            <div key={m.manager_id} className="bg-white border rounded-xl overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{m.full_name ?? m.email ?? "—"}</p>
                  {m.email && m.full_name && <p className="text-xs text-gray-500">{m.email}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {count === 0
                      ? "No learners assigned here (may still moderate groups)"
                      : `${count} learner${count !== 1 ? "s" : ""} assigned`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : m.manager_id)}
                    className="text-xs text-brand-600 hover:underline font-medium border border-brand-200 rounded-lg px-3 py-1.5"
                  >
                    {isExpanded ? "Close" : "Manage cohort"}
                  </button>
                  <button onClick={() => handleRemove(m.manager_id)} className="text-xs text-red-500 hover:underline">
                    Remove
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t px-4 py-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Assign learners to this moderator
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPendingSelections((p) => ({ ...p, [m.manager_id]: new Set(learners.map((l) => l.userId)) }))}
                        className="text-xs text-gray-500 hover:underline"
                      >
                        Select all
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        onClick={() => setPendingSelections((p) => ({ ...p, [m.manager_id]: new Set() }))}
                        className="text-xs text-gray-500 hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {learners.length === 0 ? (
                    <p className="text-xs text-gray-400 py-2">No enrolled learners yet.</p>
                  ) : (
                    <div className="space-y-1 max-h-60 overflow-y-auto mb-3">
                      {learners.map((l) => (
                        <label key={l.userId} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-white cursor-pointer">
                          <input
                            type="checkbox"
                            checked={pending.has(l.userId)}
                            onChange={() => toggleLearner(m.manager_id, l.userId)}
                            className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                          />
                          <span className="text-sm text-gray-800">{l.name}</span>
                          <span className="text-xs text-gray-400">{l.email}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-400">
                      {pending.size} selected · {pending.size === 0 ? "Moderator sees only learners from groups they moderate" : "Moderator sees these learners, plus any from groups they moderate"}
                    </p>
                    <button
                      onClick={() => saveAssignments(m.manager_id)}
                      disabled={saving}
                      className="bg-brand-600 text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-brand-700 disabled:opacity-50"
                    >
                      {saving ? "Saving…" : "Save cohort"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
