"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggleEnabled() {
    const next = !timetableEnabled;
    setTimetableEnabled(next);
    const supabase = createClient();
    await supabase.from("courses").update({ timetable_enabled: next }).eq("id", courseId);
    router.refresh();
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const method = form.id ? "PUT" : "POST";
      const body = form.id
        ? { ...form, end_time: form.end_time || null, description: form.description || null }
        : { ...form, end_time: form.end_time || null, description: form.description || null };
      const res = await fetch(`/api/admin/courses/${courseId}/timetable`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
      setSaving(false);
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
      <div className="flex items-center gap-3 bg-white border rounded-xl px-4 py-3">
        <button
          onClick={toggleEnabled}
          className={`relative w-10 h-5 rounded-full transition-colors ${timetableEnabled ? "bg-brand-600" : "bg-gray-200"}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${timetableEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
        </button>
        <span className="text-sm font-medium">{timetableEnabled ? "Timetable enabled" : "Timetable disabled"}</span>
        <span className="text-xs text-gray-400">(learners can see the timetable tab when enabled)</span>
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
                    <div key={e.id} className="px-4 py-3 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{e.title}</span>
                          <span className="text-xs text-gray-400">
                            {e.start_time.slice(0, 5)}{e.end_time ? ` – ${e.end_time.slice(0, 5)}` : ""}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${e.location_type === "online" ? "bg-blue-50 text-blue-700" : "bg-green-50 text-green-700"}`}>
                            {e.location_type === "online" ? "Online" : "In person"}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{e.location}</p>
                        {e.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{e.description}</p>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => setForm({ ...e, end_time: e.end_time ?? "", description: e.description ?? "" })}
                          className="text-xs text-brand-600 hover:underline px-2 py-1"
                        >
                          Edit
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
          <p className="text-xs text-orange-600">Saving will notify all enrolled learners via announcement.</p>
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving || !form.date || !form.start_time || !form.title || !form.location}
              className="text-sm bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-40"
            >
              {saving ? "Saving..." : form.id ? "Save changes" : "Add entry"}
            </button>
            <button onClick={() => { setForm(null); setError(null); }} className="text-sm border px-4 py-2 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
          </div>
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
