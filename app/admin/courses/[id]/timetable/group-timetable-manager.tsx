"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type BaseEntry = {
  id: string;
  date: string;
  start_time: string;
  end_time: string | null;
  title: string;
  location: string;
  location_type: "online" | "in_person";
  description: string | null;
  moderator_adjustable?: boolean;
};

export type Override = {
  entry_id: string;
  group_id: string;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  hidden: boolean;
};

type Group = { id: string; name: string };

/**
 * The moderator's view of a course timetable (ADR-0005, Model B).
 *
 * A moderator does not edit the shared agenda — they layer their group's version on
 * top of it. Only slots the creator ticked are adjustable; everything else is shown
 * read-only so the moderator can still see their group's whole day in context
 * rather than a disembodied list of the bits they happen to control.
 *
 * Every field defaults to inheriting the base, so a creator's later edit still flows
 * through to any field this group has not deliberately changed.
 */
export function GroupTimetableManager({
  courseId,
  groups,
  entries,
  initialOverrides,
}: {
  courseId: string;
  groups: Group[];
  entries: BaseEntry[];
  initialOverrides: Override[];
}) {
  const router = useRouter();
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [overrides, setOverrides] = useState<Override[]>(initialOverrides);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const ovFor = (entryId: string) =>
    overrides.find((o) => o.entry_id === entryId && o.group_id === groupId) ?? null;

  /** Resolved value: this group's override if set, else the shared base. */
  const shown = (e: BaseEntry) => {
    const o = ovFor(e.id);
    return {
      title: o?.title ?? e.title,
      start_time: o?.start_time ?? e.start_time,
      end_time: o?.end_time ?? e.end_time,
      location: o?.location ?? e.location,
      hidden: o?.hidden ?? false,
      adjusted: !!o && (o.title !== null || o.start_time !== null || o.end_time !== null || o.location !== null || o.hidden),
    };
  };

  async function save(entryId: string, patch: Partial<Override>) {
    setBusyId(entryId);
    setErrors((p) => { const { [entryId]: _d, ...rest } = p; return rest; });
    const previous = overrides;
    const existing = ovFor(entryId);
    const next: Override = {
      entry_id: entryId,
      group_id: groupId,
      title: null, start_time: null, end_time: null, location: null, hidden: false,
      ...existing,
      ...patch,
    };
    setOverrides((prev) => [...prev.filter((o) => !(o.entry_id === entryId && o.group_id === groupId)), next]);

    try {
      const res = await fetch(`/api/admin/courses/${courseId}/timetable/override`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) {
        const msg = (await res.text()) || "Could not save that adjustment.";
        setOverrides(previous);
        setErrors((p) => ({ ...p, [entryId]: msg }));
      }
    } catch {
      setOverrides(previous);
      setErrors((p) => ({ ...p, [entryId]: "Network error — that adjustment was not saved." }));
    } finally {
      setBusyId(null);
    }
  }

  /** Drop this group's override entirely — the slot returns to the shared agenda. */
  async function revert(entryId: string) {
    setBusyId(entryId);
    const previous = overrides;
    setOverrides((prev) => prev.filter((o) => !(o.entry_id === entryId && o.group_id === groupId)));
    try {
      const res = await fetch(`/api/admin/courses/${courseId}/timetable/override`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry_id: entryId, group_id: groupId }),
      });
      if (!res.ok) {
        const msg = (await res.text()) || "Could not undo that adjustment.";
        setOverrides(previous);
        setErrors((p) => ({ ...p, [entryId]: msg }));
      } else {
        router.refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  const byDate: Record<string, BaseEntry[]> = {};
  for (const e of entries) (byDate[e.date] ||= []).push(e);
  const adjustedCount = overrides.filter((o) => o.group_id === groupId).length;

  return (
    <div className="space-y-5">
      <div className="bg-white border rounded-xl px-4 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <label htmlFor="group" className="text-sm font-medium">Adjusting for</label>
          <select
            id="group"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm"
          >
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <span className="text-xs text-gray-400">
            {adjustedCount === 0 ? "following the shared agenda exactly" : `${adjustedCount} session${adjustedCount === 1 ? "" : "s"} adjusted for this group`}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          You are layering your group&apos;s version over the course agenda. Only sessions the course
          creator has opened (<span className="text-purple-700">◈</span>) can be changed. Anything you
          don&apos;t change keeps following the shared agenda, including later edits by the creator.
        </p>
      </div>

      {Object.entries(byDate).map(([date, dayEntries]) => (
        <div key={date} className="bg-white border rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 border-b">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              {new Date(date + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "long", year: "numeric", month: "long", day: "numeric",
              })}
            </p>
          </div>
          <div className="divide-y">
            {dayEntries.map((e) => {
              const v = shown(e);
              const open = e.moderator_adjustable === true;
              return (
                <div key={e.id} className={`px-4 py-3 ${v.hidden ? "opacity-40" : ""}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-mono text-gray-500 w-24 shrink-0 pt-0.5">
                      {String(v.start_time).slice(0, 5)}
                      {v.end_time ? `–${String(v.end_time).slice(0, 5)}` : ""}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm ${v.adjusted ? "font-semibold text-purple-800" : "font-medium"}`}>
                          {v.title}
                        </span>
                        {v.adjusted && !v.hidden && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700">adjusted for your group</span>
                        )}
                        {v.hidden && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600">hidden from your group</span>
                        )}
                        {!open && (
                          <span className="text-[11px] text-gray-400" title="The course creator has not opened this session for group adjustments">◇ shared</span>
                        )}
                        {busyId === e.id && <span className="text-xs text-gray-400">saving…</span>}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{v.location}</p>
                      {errors[e.id] && <p className="text-xs text-red-600 mt-1">{errors[e.id]}</p>}
                    </div>

                    {open && (
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => {
                            const t = window.prompt("Title for your group:", v.title);
                            if (t !== null && t.trim()) void save(e.id, { title: t.trim() });
                          }}
                          className="text-xs text-brand-600 hover:underline px-2 py-1"
                        >
                          Retitle
                        </button>
                        <button
                          onClick={() => {
                            const t = window.prompt("Start time for your group (HH:MM, Armenia time):", String(v.start_time).slice(0, 5));
                            if (t && /^\d{2}:\d{2}$/.test(t)) void save(e.id, { start_time: t });
                          }}
                          className="text-xs text-brand-600 hover:underline px-2 py-1"
                        >
                          Retime
                        </button>
                        <button
                          onClick={() => void save(e.id, { hidden: !v.hidden })}
                          className="text-xs text-gray-500 hover:underline px-2 py-1"
                        >
                          {v.hidden ? "Unhide" : "Hide"}
                        </button>
                        {v.adjusted && (
                          <button
                            onClick={() => void revert(e.id)}
                            className="text-xs text-amber-600 hover:underline px-2 py-1"
                            title="Discard your group's changes and follow the shared agenda again"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {entries.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">No schedule entries yet.</p>
      )}
    </div>
  );
}
