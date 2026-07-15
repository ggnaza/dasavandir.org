"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Click-to-edit text. Commits on Enter or blur, reverts on Escape.
 * Renders as plain text until clicked so the agenda stays readable at a glance.
 */
function InlineText({
  value,
  onCommit,
  className = "",
  placeholder = "—",
  title,
}: {
  value: string;
  onCommit: (next: string) => void;
  className?: string;
  placeholder?: string;
  title?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const cancelled = useRef(false);

  useEffect(() => { setDraft(value); }, [value]);

  if (!editing) {
    return (
      <span
        role="button"
        tabIndex={0}
        title={title ?? "Click to edit"}
        onClick={() => { cancelled.current = false; setEditing(true); }}
        onKeyDown={(e) => { if (e.key === "Enter") { cancelled.current = false; setEditing(true); } }}
        className={`cursor-text rounded px-1 -mx-1 hover:bg-brand-50 focus:outline-none focus:ring-1 focus:ring-brand-300 ${className}`}
      >
        {value?.trim() ? value : <span className="text-gray-300">{placeholder}</span>}
      </span>
    );
  }

  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        if (cancelled.current) { setDraft(value); return; }
        if (draft !== value) onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
        if (e.key === "Escape") { cancelled.current = true; e.currentTarget.blur(); }
      }}
      className={`border border-brand-300 rounded px-1 -mx-1 py-0 focus:outline-none focus:ring-1 focus:ring-brand-400 w-full ${className}`}
    />
  );
}

/** Click-to-edit time field. Commits on change/blur; Escape reverts. */
function InlineTime({
  value,
  onCommit,
  placeholder = "--:--",
}: {
  value: string | null;
  onCommit: (next: string) => void;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const shown = value ? value.slice(0, 5) : "";
  const [draft, setDraft] = useState(shown);
  const cancelled = useRef(false);

  useEffect(() => { setDraft(value ? value.slice(0, 5) : ""); }, [value]);

  if (!editing) {
    return (
      <span
        role="button"
        tabIndex={0}
        title="Click to edit time"
        onClick={() => { cancelled.current = false; setEditing(true); }}
        onKeyDown={(e) => { if (e.key === "Enter") { cancelled.current = false; setEditing(true); } }}
        className="cursor-text rounded px-1 -mx-1 hover:bg-brand-50 font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-brand-300"
      >
        {shown || <span className="text-gray-300">{placeholder}</span>}
      </span>
    );
  }

  return (
    <input
      type="time"
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        if (cancelled.current) { setDraft(shown); return; }
        if (draft && draft !== shown) onCommit(draft);
        else setDraft(shown);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
        if (e.key === "Escape") { cancelled.current = true; e.currentTarget.blur(); }
      }}
      className="border border-brand-300 rounded px-1 py-0 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-brand-400"
    />
  );
}

type Entry = {
  id: string;
  date: string;
  start_time: string;
  end_time: string | null;
  title: string;
  location: string;
  location_type: "online" | "in_person";
  description: string | null;
};

type FormState = Omit<Entry, "id"> & { id?: string };

const EMPTY_FORM: FormState = {
  date: "",
  start_time: "",
  end_time: "",
  title: "",
  location: "",
  location_type: "online",
  description: "",
};

export function TimetableManager({
  courseId,
  enabled,
  initialEntries,
}: {
  courseId: string;
  enabled: boolean;
  initialEntries: Entry[];
}) {
  const router = useRouter();
  const [timetableEnabled, setTimetableEnabled] = useState(enabled);
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState<"save" | "announce" | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  /**
   * Persist a single-field inline edit. Optimistic, reverting on failure —
   * an inline edit that silently no-ops is the defect this UI must not have.
   * Never announces: an inline tweak must not email every enrolled learner.
   */
  async function patchEntry(entry: Entry, patch: Partial<Entry>) {
    const next = { ...entry, ...patch };

    if (!next.title.trim()) {
      setRowErrors((p) => ({ ...p, [entry.id]: "Title cannot be empty." }));
      return;
    }
    if (!next.start_time) {
      setRowErrors((p) => ({ ...p, [entry.id]: "Start time is required." }));
      return;
    }
    if (next.end_time && next.end_time.slice(0, 5) < next.start_time.slice(0, 5)) {
      setRowErrors((p) => ({ ...p, [entry.id]: "End time is before the start time." }));
      return;
    }

    setEntries((prev) => prev.map((e) => (e.id === entry.id ? next : e)));
    setSavingRowId(entry.id);
    setRowErrors((p) => { const { [entry.id]: _drop, ...rest } = p; return rest; });

    const revert = (msg: string) => {
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? entry : e)));
      setRowErrors((p) => ({ ...p, [entry.id]: msg }));
    };

    try {
      const res = await fetch(`/api/admin/courses/${courseId}/timetable`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: entry.id,
          date: next.date,
          start_time: next.start_time,
          end_time: next.end_time || null,
          title: next.title,
          location: next.location,
          location_type: next.location_type,
          description: next.description || null,
          announce: false,
        }),
      });
      if (!res.ok) { revert((await res.text()) || "Could not save that change."); return; }
      const saved: Entry = await res.json();
      setEntries((prev) => prev.map((e) => (e.id === saved.id ? saved : e)));
    } catch {
      revert("Network error — that change was not saved.");
    } finally {
      setSavingRowId(null);
    }
  }

  async function toggleEnabled() {
    if (toggling) return;
    const previous = timetableEnabled;
    const next = !previous;
    setTimetableEnabled(next);
    setToggling(true);
    setToggleError(null);

    const supabase = createClient();
    // Select the updated row back: an RLS-blocked update returns no error, it
    // just affects zero rows. Without this, a failed toggle looks like success.
    const { data, error: updateError } = await supabase
      .from("courses")
      .update({ timetable_enabled: next })
      .eq("id", courseId)
      .select("id");

    setToggling(false);

    if (updateError || !data?.length) {
      setTimetableEnabled(previous);
      setToggleError(
        updateError
          ? `Could not ${next ? "enable" : "disable"} the timetable: ${updateError.message}`
          : `Could not ${next ? "enable" : "disable"} the timetable — you do not have permission to change this course.`
      );
      return;
    }

    router.refresh();
  }

  async function save(announce: boolean) {
    if (!form) return;
    setSaving(announce ? "announce" : "save");
    setError(null);
    try {
      const method = form.id ? "PUT" : "POST";
      const payload = {
        ...form,
        end_time: form.end_time || null,
        description: form.description || null,
        announce,
      };
      const res = await fetch(`/api/admin/courses/${courseId}/timetable`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { setError(await res.text()); return; }
      const saved: Entry = await res.json();
      if (form.id) {
        setEntries((prev) => prev.map((e) => (e.id === saved.id ? saved : e)));
      } else {
        setEntries((prev) => [...prev, saved].sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time)));
      }
      setForm(null);
    } finally {
      setSaving(null);
    }
  }

  async function deleteEntry(id: string) {
    if (!confirm("Delete this entry? Enrolled learners won't be notified of the removal.")) return;
    setDeletingId(id);
    await fetch(`/api/admin/courses/${courseId}/timetable`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setDeletingId(null);
  }

  // Group entries by date
  const byDate: Record<string, Entry[]> = {};
  for (const e of entries) {
    if (!byDate[e.date]) byDate[e.date] = [];
    byDate[e.date].push(e);
  }

  return (
    <div className="space-y-6">
      {/* Enable toggle */}
      <div className="bg-white border rounded-xl px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleEnabled}
            disabled={toggling}
            className={`relative w-10 h-5 rounded-full transition-colors disabled:opacity-50 ${timetableEnabled ? "bg-brand-600" : "bg-gray-200"}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${timetableEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
          <span className="text-sm font-medium">{timetableEnabled ? "Timetable enabled" : "Timetable disabled"}</span>
          <span className="text-xs text-gray-400">(learners can see the timetable tab when enabled)</span>
        </div>
        {toggleError && <p className="text-xs text-red-600 mt-2">{toggleError}</p>}
      </div>

      {/* Entry list */}
      {Object.keys(byDate).length > 0 && (
        <div className="space-y-4">
          {Object.entries(byDate).map(([date, dayEntries]) => {
            const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("en-US", {
              weekday: "long", year: "numeric", month: "long", day: "numeric",
            });
            return (
              <div key={date} className="bg-white border rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{dateLabel}</p>
                </div>
                <div className="divide-y">
                  {dayEntries.map((e) => (
                    <div key={e.id} className="px-4 py-3 flex items-start gap-3 group">
                      {/* Times — click to edit in place */}
                      <div className="flex items-center gap-1 text-xs text-gray-500 shrink-0 w-28 pt-0.5">
                        <InlineTime value={e.start_time} onCommit={(v) => patchEntry(e, { start_time: v })} />
                        <span className="text-gray-300">–</span>
                        <InlineTime value={e.end_time} onCommit={(v) => patchEntry(e, { end_time: v })} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <InlineText
                            value={e.title}
                            onCommit={(v) => patchEntry(e, { title: v })}
                            className="text-sm font-medium"
                            placeholder="Untitled session"
                          />
                          <button
                            onClick={() =>
                              patchEntry(e, { location_type: e.location_type === "online" ? "in_person" : "online" })
                            }
                            title="Click to switch"
                            className={`text-xs px-1.5 py-0.5 rounded-full transition-colors ${e.location_type === "online" ? "bg-blue-50 text-blue-700 hover:bg-blue-100" : "bg-green-50 text-green-700 hover:bg-green-100"}`}
                          >
                            {e.location_type === "online" ? "Online" : "In person"}
                          </button>
                          {savingRowId === e.id && <span className="text-xs text-gray-400">saving…</span>}
                        </div>
                        <InlineText
                          value={e.location}
                          onCommit={(v) => patchEntry(e, { location: v })}
                          className="text-xs text-gray-500 block mt-0.5"
                          placeholder="Add a location"
                        />
                        <InlineText
                          value={e.description ?? ""}
                          onCommit={(v) => patchEntry(e, { description: v })}
                          className="text-xs text-gray-400 block mt-0.5"
                          placeholder="Add a description"
                        />
                        {rowErrors[e.id] && (
                          <p className="text-xs text-red-600 mt-1">{rowErrors[e.id]}</p>
                        )}
                      </div>

                      <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <button
                          onClick={() => setForm({ ...e, end_time: e.end_time ?? "", description: e.description ?? "" })}
                          title="Open the full form (lets you announce the change)"
                          className="text-xs text-brand-600 hover:underline px-2 py-1"
                        >
                          More
                        </button>
                        <button
                          onClick={() => deleteEntry(e.id)}
                          disabled={deletingId === e.id}
                          className="text-xs text-red-500 hover:underline px-2 py-1 disabled:opacity-40"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {entries.length === 0 && !form && (
        <p className="text-sm text-gray-400 text-center py-8">No schedule entries yet. Add one below.</p>
      )}

      {/* Add / Edit form */}
      {form ? (
        <div className="bg-white border rounded-xl p-5 space-y-4">
          <h3 className="font-medium text-sm">{form.id ? "Edit entry" : "New entry"}</h3>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => f && { ...f, date: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Agenda name *</label>
              <input
                type="text"
                placeholder="e.g. Morning session"
                value={form.title}
                onChange={(e) => setForm((f) => f && { ...f, title: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Start time *</label>
              <input
                type="time"
                value={form.start_time}
                onChange={(e) => setForm((f) => f && { ...f, start_time: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">End time</label>
              <input
                type="time"
                value={form.end_time ?? ""}
                onChange={(e) => setForm((f) => f && { ...f, end_time: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Place *</label>
              <input
                type="text"
                placeholder="e.g. Zoom link or room name"
                value={form.location}
                onChange={(e) => setForm((f) => f && { ...f, location: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Type</label>
              <select
                value={form.location_type}
                onChange={(e) => setForm((f) => f && { ...f, location_type: e.target.value as "online" | "in_person" })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="online">Online</option>
                <option value="in_person">In person</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Notes (optional)</label>
            <textarea
              placeholder="Additional details..."
              value={form.description ?? ""}
              onChange={(e) => setForm((f) => f && { ...f, description: e.target.value })}
              rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => save(false)}
              disabled={!!saving || !form.date || !form.start_time || !form.title || !form.location}
              className="text-sm bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-40"
            >
              {saving === "save" ? "Saving..." : form.id ? "Save changes" : "Add entry"}
            </button>
            <button
              onClick={() => save(true)}
              disabled={!!saving || !form.date || !form.start_time || !form.title || !form.location}
              className="text-sm border border-brand-400 text-brand-600 px-4 py-2 rounded-lg hover:bg-brand-50 disabled:opacity-40"
            >
              {saving === "announce" ? "Sending..." : form.id ? "Save & announce" : "Add & announce"}
            </button>
            <button onClick={() => { setForm(null); setError(null); }} className="text-sm border px-4 py-2 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
          </div>
          <p className="text-xs text-gray-400">"Save" stores the change silently — learners are notified at 8am via the daily digest. "Save &amp; announce" sends an immediate notification.</p>
        </div>
      ) : (
        <button
          onClick={() => setForm({ ...EMPTY_FORM })}
          className="text-sm border border-dashed border-gray-300 text-gray-500 rounded-xl px-4 py-3 w-full hover:bg-gray-50"
        >
          + Add schedule entry
        </button>
      )}
    </div>
  );
}
