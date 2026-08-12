"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Member = { id: string; name: string; email: string };
type Group = { id: string; name: string; moderator_id: string | null; phase_id: string | null; members: Member[] };
type Reviewer = { id: string; name: string; role: string };
type Phase = { id: string; name: string; ord: number };

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin", course_creator: "Creator", course_manager: "Moderator", learner: "Learner",
};

export function GroupsManager({
  courseId,
  phases = [],
  groups: initialGroups,
  allLearners,
  reviewers = [],
  canAssignModerator = false,
}: {
  courseId: string;
  phases?: Phase[];
  groups: Group[];
  allLearners: Member[];
  reviewers?: Reviewer[];
  canAssignModerator?: boolean;
}) {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [savingMod, setSavingMod] = useState<string | null>(null);

  // Phase scoping (ADR-0003). A course with no phases behaves exactly as before:
  // no tabs, all groups shown, one-group-per-course. A phased course (e.g. TLA ->
  // Regional Orientation) shows a tab per phase; groups, the unassigned banner and
  // the add-member picker are all scoped to the selected phase.
  const hasPhases = phases.length > 0;
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);
  // Derive the active phase with a fallback: a plain useState isn't reset when the
  // server re-renders after refresh(), so a just-created (or deleted) phase would
  // otherwise leave the selection dangling. Fall back to the first phase.
  const effectivePhase = hasPhases
    ? (phases.some((p) => p.id === selectedPhase) ? selectedPhase : phases[0].id)
    : null;
  const visibleGroups = hasPhases ? groups.filter((g) => g.phase_id === effectivePhase) : groups;
  const takenInPhase = new Set(visibleGroups.flatMap((g) => g.members.map((m) => m.id)));
  const unassigned = allLearners.filter((l) => !takenInPhase.has(l.id));
  const selectedPhaseName = phases.find((p) => p.id === effectivePhase)?.name ?? "";

  async function assignModerator(groupId: string, moderatorId: string) {
    setSavingMod(groupId);
    await fetch(`/api/admin/groups/${groupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moderator_id: moderatorId || null }),
    });
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, moderator_id: moderatorId || null } : g)));
    setSavingMod(null);
    router.refresh();
  }

  // New group creation
  const [newGroupName, setNewGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Phase management (admins / creators only)
  const [newPhaseName, setNewPhaseName] = useState("");
  const [addingPhase, setAddingPhase] = useState(false);
  const [phaseError, setPhaseError] = useState("");

  async function addPhase() {
    const name = newPhaseName.trim();
    if (!name) return;
    setAddingPhase(true);
    setPhaseError("");
    const res = await fetch(`/api/admin/courses/${courseId}/phases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) { setPhaseError(await res.text()); setAddingPhase(false); return; }
    setNewPhaseName("");
    setAddingPhase(false);
    refresh();
  }

  async function deletePhase(phaseId: string, name: string) {
    if (!confirm(`Delete phase "${name}"? Its groups and lessons become untagged (not deleted).`)) return;
    await fetch(`/api/admin/courses/${courseId}/phases/${phaseId}`, { method: "DELETE" });
    // effectivePhase falls back to the first remaining phase after refresh, so no
    // manual re-selection is needed here.
    refresh();
  }

  // Editing state per group
  const [editingNames, setEditingNames] = useState<Record<string, string>>({});
  const [savingName, setSavingName] = useState<string | null>(null);

  // Add member state per group (multi-select)
  const [addingTo, setAddingTo] = useState<string | null>(null); // groupId
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [addingMember, setAddingMember] = useState(false);
  const [addError, setAddError] = useState("");

  function openAddPanel(groupId: string) {
    setAddingTo(groupId);
    setSelectedMemberIds([]);
    setAddError("");
  }
  function closeAddPanel() {
    setAddingTo(null);
    setSelectedMemberIds([]);
    setAddError("");
  }
  function toggleSelected(id: string, checked: boolean) {
    setAddError("");
    setSelectedMemberIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  }

  function refresh() {
    router.refresh();
  }

  async function createGroup() {
    if (!newGroupName.trim()) return;
    setCreating(true);
    setCreateError("");
    const res = await fetch(`/api/admin/courses/${courseId}/groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newGroupName.trim(), phase_id: effectivePhase }),
    });
    if (!res.ok) { setCreateError(await res.text()); setCreating(false); return; }
    setNewGroupName("");
    setCreating(false);
    refresh();
  }

  async function renameGroup(groupId: string) {
    const name = editingNames[groupId]?.trim();
    if (!name) return;
    setSavingName(groupId);
    await fetch(`/api/admin/groups/${groupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSavingName(null);
    setEditingNames((prev) => { const n = { ...prev }; delete n[groupId]; return n; });
    refresh();
  }

  async function deleteGroup(groupId: string, groupName: string) {
    if (!confirm(`Delete "${groupName}"? All members will be unassigned.`)) return;
    await fetch(`/api/admin/groups/${groupId}`, { method: "DELETE" });
    refresh();
  }

  async function addMembers(groupId: string) {
    if (selectedMemberIds.length === 0) return;
    setAddingMember(true);
    setAddError("");
    // The members endpoint adds one learner at a time; add them sequentially and
    // collect any failures (e.g. someone concurrently assigned elsewhere).
    let failures = 0;
    let lastError = "";
    for (const userId of selectedMemberIds) {
      const res = await fetch(`/api/admin/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) { failures++; lastError = await res.text(); }
    }
    setAddingMember(false);
    if (failures > 0) {
      setAddError(`${failures} learner${failures !== 1 ? "s" : ""} couldn't be added: ${lastError}`);
    } else {
      setAddingTo(null);
    }
    setSelectedMemberIds([]);
    refresh();
  }

  async function removeMember(groupId: string, userId: string) {
    await fetch(`/api/admin/groups/${groupId}/members?userId=${userId}`, { method: "DELETE" });
    refresh();
  }

  // Learners addable to this group: anyone not already in a group within the current
  // phase (the server enforces one group per phase, so surfacing them would only lead
  // to an error). takenInPhase already includes this group's own members.
  function addableLearners(_group: Group): Member[] {
    return allLearners.filter((l) => !takenInPhase.has(l.id));
  }

  return (
    <div className="space-y-6">
      {/* Phase management — admins / creators only. Bootstraps a course into phases
          (e.g. "TLA" + "Regional Orientation") and drives the tabs below (ADR-0003). */}
      {canAssignModerator && (
        <div className="bg-white border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Phases</h2>
            {!hasPhases && (
              <span className="text-xs text-gray-400">Optional — leave empty for a single-stage course.</span>
            )}
          </div>
          {hasPhases && (
            <div className="flex flex-wrap gap-2 mb-3">
              {phases.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-full pl-3 pr-2 py-1">
                  {p.name}
                  <button
                    onClick={() => deletePhase(p.id, p.name)}
                    className="text-gray-400 hover:text-red-600"
                    title="Delete phase"
                  >✕</button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={newPhaseName}
              onChange={(e) => setNewPhaseName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addPhase()}
              placeholder="Add a phase (e.g. TLA, Regional Orientation)"
              maxLength={100}
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              onClick={addPhase}
              disabled={addingPhase || !newPhaseName.trim()}
              className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-50"
            >
              {addingPhase ? "Adding…" : "+ Add phase"}
            </button>
          </div>
          {phaseError && <p className="text-red-600 text-xs mt-2">{phaseError}</p>}
        </div>
      )}

      {/* Phase tabs — only for courses that use phases (ADR-0003) */}
      {hasPhases && (
        <div className="flex gap-1 border-b border-gray-200">
          {phases.map((p) => (
            <button
              key={p.id}
              onClick={() => { setSelectedPhase(p.id); closeAddPanel(); }}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                effectivePhase === p.id
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Create new group */}
      <div className="bg-white border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Create new group{hasPhases && selectedPhaseName ? ` — ${selectedPhaseName}` : ""}
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createGroup()}
            placeholder="Group name (e.g. Group A, Team Alpha)"
            maxLength={100}
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            onClick={createGroup}
            disabled={creating || !newGroupName.trim()}
            className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            {creating ? "Creating…" : "+ Create"}
          </button>
        </div>
        {createError && <p className="text-red-600 text-xs mt-2">{createError}</p>}
      </div>

      {/* Unassigned learners summary */}
      {unassigned.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3">
          <p className="text-sm text-amber-800">
            <span className="font-semibold">{unassigned.length} learner{unassigned.length !== 1 ? "s" : ""} not in any group:</span>{" "}
            {unassigned.slice(0, 5).map((l) => l.name).join(", ")}
            {unassigned.length > 5 ? ` and ${unassigned.length - 5} more` : ""}
          </p>
        </div>
      )}

      {/* Group list (scoped to the selected phase when the course uses phases) */}
      {visibleGroups.length === 0 ? (
        <div className="bg-white border rounded-xl p-10 text-center text-gray-400">
          No groups{hasPhases && selectedPhaseName ? ` in ${selectedPhaseName}` : ""} yet. Create one above.
        </div>
      ) : (
        <div className="space-y-4">
          {visibleGroups.map((group) => {
            const isEditingName = editingNames[group.id] !== undefined;
            const isAddingHere = addingTo === group.id;

            return (
              <div key={group.id} className="bg-white border rounded-xl overflow-hidden">
                {/* Group header */}
                <div className="px-5 py-3 bg-gray-50 border-b flex items-center gap-3">
                  {isEditingName ? (
                    <input
                      autoFocus
                      value={editingNames[group.id]}
                      onChange={(e) => setEditingNames((p) => ({ ...p, [group.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") renameGroup(group.id);
                        if (e.key === "Escape") setEditingNames((p) => { const n = {...p}; delete n[group.id]; return n; });
                      }}
                      className="flex-1 border rounded px-2 py-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  ) : (
                    <span className="flex-1 text-sm font-semibold text-gray-800">{group.name}</span>
                  )}

                  <span className="text-xs text-gray-400">{group.members.length} member{group.members.length !== 1 ? "s" : ""}</span>

                  {isEditingName ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => renameGroup(group.id)}
                        disabled={savingName === group.id}
                        className="text-xs bg-brand-600 text-white px-2.5 py-1 rounded hover:bg-brand-700 disabled:opacity-50"
                      >
                        {savingName === group.id ? "Saving…" : "Save"}
                      </button>
                      <button
                        onClick={() => setEditingNames((p) => { const n = {...p}; delete n[group.id]; return n; })}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >Cancel</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingNames((p) => ({ ...p, [group.id]: group.name }))}
                        className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-200"
                        title="Rename"
                      >✎ Rename</button>
                      <button
                        onClick={() => deleteGroup(group.id, group.name)}
                        className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50"
                        title="Delete group"
                      >✕ Delete</button>
                    </div>
                  )}
                </div>

                {/* Moderator (assigned reviewer for this group) */}
                <div className="px-5 py-2.5 border-b flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-gray-500">Moderator (reviews this group):</span>
                  {canAssignModerator ? (
                    <>
                      <select
                        value={group.moderator_id ?? ""}
                        disabled={savingMod === group.id}
                        onChange={(e) => assignModerator(group.id, e.target.value)}
                        className="text-sm border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
                      >
                        <option value="">— Unassigned —</option>
                        {reviewers.map((r) => (
                          <option key={r.id} value={r.id}>{r.name} ({ROLE_LABEL[r.role] ?? r.role})</option>
                        ))}
                      </select>
                      {savingMod === group.id && <span className="text-xs text-gray-400">Saving…</span>}
                    </>
                  ) : (
                    <span className="text-sm text-gray-700">
                      {reviewers.find((r) => r.id === group.moderator_id)?.name ?? (group.moderator_id ? "Assigned" : "Unassigned")}
                    </span>
                  )}
                </div>

                {/* Members */}
                <div>
                  {group.members.length === 0 ? (
                    <p className="px-5 py-4 text-sm text-gray-400 italic">No members yet — add someone below.</p>
                  ) : (
                    <ul className="divide-y">
                      {group.members.map((m) => (
                        <li key={m.id} className="px-5 py-3 flex items-center justify-between text-sm">
                          <div>
                            <span className="font-medium text-gray-800">{m.name}</span>
                            {m.email && m.name !== m.email && (
                              <span className="text-gray-400 text-xs ml-2">{m.email}</span>
                            )}
                          </div>
                          <button
                            onClick={() => removeMember(group.id, m.id)}
                            className="text-xs text-red-400 hover:text-red-600 hover:underline"
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Add members row — multi-select. Learners already in a group for
                      this phase are excluded (one group per learner per phase). */}
                  <div className="px-5 py-3 bg-gray-50 border-t">
                    {isAddingHere ? (
                      (() => {
                        const options = addableLearners(group);
                        return (
                          <div className="space-y-2">
                            {options.length === 0 ? (
                              <p className="text-sm text-gray-400 italic">
                                Every eligible learner is already in a group for this phase.
                              </p>
                            ) : (
                              <>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-500">
                                    Select learners to add ({selectedMemberIds.length} selected)
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedMemberIds(
                                        selectedMemberIds.length === options.length ? [] : options.map((l) => l.id)
                                      )
                                    }
                                    className="text-xs text-brand-600 hover:underline"
                                  >
                                    {selectedMemberIds.length === options.length ? "Clear all" : "Select all"}
                                  </button>
                                </div>
                                <div className="max-h-56 overflow-y-auto border rounded-lg bg-white divide-y">
                                  {options.map((l) => (
                                    <label
                                      key={l.id}
                                      className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={selectedMemberIds.includes(l.id)}
                                        onChange={(e) => toggleSelected(l.id, e.target.checked)}
                                        className="accent-brand-600"
                                      />
                                      <span className="font-medium text-gray-800">{l.name}</span>
                                      {l.name !== l.email && l.email && (
                                        <span className="text-gray-400 text-xs">{l.email}</span>
                                      )}
                                    </label>
                                  ))}
                                </div>
                              </>
                            )}
                            <div className="flex gap-2 items-center">
                              <button
                                onClick={() => addMembers(group.id)}
                                disabled={addingMember || selectedMemberIds.length === 0}
                                className="text-sm bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-50 font-medium"
                              >
                                {addingMember
                                  ? "Adding…"
                                  : `Add${selectedMemberIds.length ? ` ${selectedMemberIds.length}` : ""}`}
                              </button>
                              <button
                                onClick={closeAddPanel}
                                className="text-sm text-gray-500 hover:text-gray-700"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <button
                        onClick={() => openAddPanel(group.id)}
                        className="text-sm text-brand-600 hover:underline font-medium"
                      >
                        + Add members
                      </button>
                    )}
                    {isAddingHere && addError && (
                      <p className="text-red-600 text-xs mt-1.5">{addError}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
