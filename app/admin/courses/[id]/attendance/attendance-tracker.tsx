"use client";
import { useState, useEffect, useRef } from "react";

type Entry = {
  id: string;
  date: string;
  start_time: string;
  end_time: string | null;
  title: string;
  location: string;
  location_type: string;
};

type Learner = { user_id: string; name: string; email: string };
type AttendanceRow = { user_id: string; status: Status; note: string | null };
type Status = "on_time" | "late" | "absent" | "unmarked";

const STATUS_LABELS: Record<Status, string> = {
  on_time: "On time",
  late: "Late",
  absent: "Absent",
  unmarked: "—",
};

const STATUS_COLORS: Record<Status, string> = {
  on_time: "bg-green-100 text-green-700",
  late: "bg-amber-100 text-amber-700",
  absent: "bg-red-100 text-red-700",
  unmarked: "bg-gray-100 text-gray-400",
};

export function AttendanceTracker({
  courseId,
  entries,
  isManager,
}: {
  courseId: string;
  entries: Entry[];
  isManager: boolean;
}) {
  // Group entries by date
  const byDate: Record<string, Entry[]> = {};
  for (const e of entries) {
    if (!byDate[e.date]) byDate[e.date] = [];
    byDate[e.date].push(e);
  }
  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a)); // newest first

  const [selectedDate, setSelectedDate] = useState<string>(sortedDates[0] ?? "");
  const [selectedEntryId, setSelectedEntryId] = useState<string>("");
  const [learners, setLearners] = useState<Learner[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceRow>>({});
  const [loadingSession, setLoadingSession] = useState(false);
  // savingKey = `${userId}-status` or `${userId}-note`
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const noteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // When date changes, reset entry selection to first entry of that date
  useEffect(() => {
    const firstEntry = byDate[selectedDate]?.[0];
    setSelectedEntryId(firstEntry?.id ?? "");
  }, [selectedDate]);

  // Load learners + attendance when entry changes
  useEffect(() => {
    if (!selectedEntryId) { setLearners([]); setAttendance({}); return; }
    setLoadingSession(true);
    fetch(`/api/admin/courses/${courseId}/attendance?entry_id=${selectedEntryId}`)
      .then((r) => r.json())
      .then(({ learners: ls, attendance: rows }: { learners: Learner[]; attendance: AttendanceRow[] }) => {
        setLearners(ls);
        const map: Record<string, AttendanceRow> = {};
        for (const r of rows) map[r.user_id] = r;
        setAttendance(map);
      })
      .finally(() => setLoadingSession(false));
  }, [selectedEntryId]);

  async function upsert(userId: string, patch: Partial<AttendanceRow>) {
    const current = attendance[userId] ?? { user_id: userId, status: "unmarked", note: null };
    const next = { ...current, ...patch };
    setAttendance((prev) => ({ ...prev, [userId]: next }));

    const key = userId + (patch.status !== undefined ? "-status" : "-note");
    setSaving((prev) => ({ ...prev, [key]: true }));
    await fetch(`/api/admin/courses/${courseId}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timetable_entry_id: selectedEntryId,
        user_id: userId,
        status: next.status,
        note: next.note,
      }),
    });
    setSaving((prev) => ({ ...prev, [key]: false }));
  }

  function handleStatus(userId: string, status: Status) {
    upsert(userId, { status });
  }

  function handleNote(userId: string, note: string) {
    // Optimistic update immediately, debounce the save
    setAttendance((prev) => ({
      ...prev,
      [userId]: { ...(prev[userId] ?? { user_id: userId, status: "unmarked", note: null }), note },
    }));
    const key = userId + "-note";
    clearTimeout(noteTimers.current[key]);
    noteTimers.current[key] = setTimeout(() => {
      const status = attendance[userId]?.status ?? "unmarked";
      setSaving((prev) => ({ ...prev, [key]: true }));
      fetch(`/api/admin/courses/${courseId}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timetable_entry_id: selectedEntryId, user_id: userId, status, note }),
      }).finally(() => setSaving((prev) => ({ ...prev, [key]: false })));
    }, 600);
  }

  const sessionEntries = byDate[selectedDate] ?? [];

  const summary = learners.reduce(
    (acc, l) => {
      const s = attendance[l.user_id]?.status ?? "unmarked";
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-5">
      {/* Session selector */}
      <div className="bg-white border rounded-xl p-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Date</label>
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            {sortedDates.map((d) => (
              <option key={d} value={d}>
                {new Date(d + "T00:00:00").toLocaleDateString("en-US", {
                  weekday: "short", year: "numeric", month: "short", day: "numeric",
                })}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-48">
          <label className="text-xs font-medium text-gray-600 mb-1 block">Session</label>
          <select
            value={selectedEntryId}
            onChange={(e) => setSelectedEntryId(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          >
            {sessionEntries.map((e) => {
              const timeStr = e.end_time
                ? `${e.start_time.slice(0, 5)} – ${e.end_time.slice(0, 5)}`
                : e.start_time.slice(0, 5);
              return (
                <option key={e.id} value={e.id}>
                  {timeStr} — {e.title} ({e.location})
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Summary chips */}
      {learners.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(["on_time", "late", "absent", "unmarked"] as Status[]).map((s) => (
            <span key={s} className={`text-xs px-3 py-1 rounded-full font-medium ${STATUS_COLORS[s]}`}>
              {STATUS_LABELS[s]}: {summary[s] ?? 0}
            </span>
          ))}
        </div>
      )}

      {/* Attendance table */}
      {loadingSession ? (
        <p className="text-sm text-gray-400 py-8 text-center">Loading...</p>
      ) : learners.length === 0 && selectedEntryId ? (
        <p className="text-sm text-gray-400 py-8 text-center">
          {isManager ? "No learners assigned to you for this course." : "No enrolled learners found."}
        </p>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1fr_160px_1fr_32px] gap-0 divide-y">
            {/* Header */}
            <div className="contents">
              <div className="px-4 py-2.5 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">Learner</div>
              <div className="px-4 py-2.5 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</div>
              <div className="px-4 py-2.5 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">Note</div>
              <div className="px-4 py-2.5 bg-gray-50" />
            </div>

            {/* Rows */}
            {learners.map((l) => {
              const row = attendance[l.user_id];
              const status: Status = row?.status ?? "unmarked";
              const note = row?.note ?? "";
              const savingStatus = saving[l.user_id + "-status"];
              const savingNote = saving[l.user_id + "-note"];

              return (
                <div key={l.user_id} className="contents group">
                  <div className="px-4 py-3 flex flex-col justify-center">
                    <span className="text-sm font-medium">{l.name}</span>
                    <span className="text-xs text-gray-400">{l.email}</span>
                  </div>
                  <div className="px-4 py-3 flex items-center">
                    <select
                      value={status}
                      onChange={(e) => handleStatus(l.user_id, e.target.value as Status)}
                      className={`text-xs font-medium px-2 py-1.5 rounded-lg border-0 outline-none cursor-pointer ${STATUS_COLORS[status]}`}
                    >
                      <option value="unmarked">— Unmarked</option>
                      <option value="on_time">On time</option>
                      <option value="late">Late</option>
                      <option value="absent">Absent</option>
                    </select>
                  </div>
                  <div className="px-4 py-3 flex items-center">
                    <input
                      type="text"
                      placeholder="Add a note..."
                      value={note}
                      onChange={(e) => handleNote(l.user_id, e.target.value)}
                      className="w-full text-sm border-0 outline-none bg-transparent placeholder-gray-300 focus:bg-gray-50 rounded px-1 py-0.5"
                    />
                  </div>
                  <div className="px-2 py-3 flex items-center justify-center">
                    {(savingStatus || savingNote) && (
                      <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" title="Saving..." />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
