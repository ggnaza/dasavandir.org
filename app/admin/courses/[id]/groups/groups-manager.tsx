"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Member = { id: string; name: string; email: string };
type Group = { id: string; name: string; moderator_id: string | null; members: Member[] };
type Reviewer = { id: string; name: string; role: string };

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin", course_creator: "Creator", course_manager: "Moderator", learner: "Learner",
};

export function GroupsManager({
  courseId,
  groups: initialGroups,
  unassignedLearners,
  allLearners,
  reviewers = [],
  canAssignModerator = false,
}: {
  courseId: string;
  groups: Group[];
  unassignedLearners: Member[];
  allLearners: Member[];
  reviewers?: Reviewer[];
  canAssignModerator?: boolean;
}) {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [unassigned, setUnassigned] = useState<Member[]>(unassignedLearners);
  const [savingMod, setSavingMod] = useState<string | null>(null);

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

  // Editing state per group
  const [editingNames, setEditingNames] = useState<Record<string, string>>({});
  const [savingName, setSavingName] = useState<string | null>(null);

  // Add member state per group
  const [addingTo, setAddingTo] = useState<string | null>(null); // groupId
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [addError, setAddError] = useState("");

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
      body: JSON.stringify({ name: newGroupName.trim() }),
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

  async function addMember(groupId: string) {
    if (!selectedMemberId) return;
    setAddingMember(true);
    setAddError("");
    const res = await fetch(`/api/admin/groups/${groupId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selectedMemberId }),
    });
    if (!res.ok) { setAddError(await res.text()); setAddingMember(false); return; }
    setAddingMember(false);
    setSelectedMemberId("");
    setAddingTo(null);
    refresh();
  }

  async function removeMember(groupId: string, userId: string) {
    await fetch(`/api/admin/groups/${groupId}/members?userId=${userId}`, { method: "DELETE" });
    refresh();
  }

  // Learners not yet in this specific group (could be in another group or unassigned)
  function addableLearners(group: Group): Member[] {
    const inGroup = new Set(group.members.map((m) => m.id));
    return allLearners.filter((l) => !inGroup.has(l.id));
  }

  return (
    <div className="space-y-6">
      {/* Create new group */}
      <div className="bg-white border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Create new group</h2>
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

      {/* Group list */}
      {groups.length === 0 ? (
        <div className="bg-white border rounded-xl p-10 text-center text-gray-400">
          No groups yet. Create one above.
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
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

                  {/* Add member row */}
                  <div className="px-5 py-3 bg-gray-50 border-t">
                    {isAddingHere ? (
                      <div className="flex gap-2 items-center">
                        <select
                          value={selectedMemberId}
                          onChange={(e) => { setSelectedMemberId(e.target.value); setAddError(""); }}
                          className="flex-1 border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        >
                          <option value="">Select a learner…</option>
                          {addableLearners(group).map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name}{l.name !== l.email ? ` (${l.email})` : ""}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => addMember(group.id)}
                          disabled={addingMember || !selectedMemberId}
                          className="text-sm bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-50 font-medium"
                        >
                          {addingMember ? "Adding…" : "Add"}
                        </button>
                        <button
                          onClick={() => { setAddingTo(null); setSelectedMemberId(""); setAddError(""); }}
                          className="text-sm text-gray-500 hover:text-gray-700"
                        >Cancel</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setAddingTo(group.id); setSelectedMemberId(""); setAddError(""); }}
                        className="text-sm text-brand-600 hover:underline font-medium"
                      >
                        + Add member
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
