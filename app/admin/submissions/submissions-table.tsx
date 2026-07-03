"use client";
import Link from "next/link";
import { useState, useMemo, useRef, useEffect } from "react";

export type SubRow = {
  id: string;
  learnerName: string;
  courseTitle: string;
  lessonId: string;
  lessonLabel: string;
  lessonOrder: number;
  assignmentTitle: string;
  reviewer: string;
  score: number | null;
  status: string;
  submittedAt: string | null;
};

const STATUS_STYLES: Record<string, string> = {
  submitted: "bg-gray-100 text-gray-600",
  ai_reviewed: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  needs_revision: "bg-amber-100 text-amber-700",
  not_approved: "bg-red-100 text-red-700",
  returned: "bg-orange-100 text-orange-700",
};
const STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  ai_reviewed: "Needs review",
  approved: "Approved",
  needs_revision: "Needs revision",
  not_approved: "Not approved",
  returned: "Returned",
};
const NEEDS_REVIEW = new Set(["submitted", "ai_reviewed", "needs_revision"]);

function fmtDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—";
}

function Funnel({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor" className={active ? "text-brand-600" : "text-gray-400"}>
      <path d="M1.5 2h13a.5.5 0 0 1 .38.82L10 9v4.5a.5.5 0 0 1-.72.45l-2.5-1.25A.5.5 0 0 1 6.5 12.75V9L1.12 2.82A.5.5 0 0 1 1.5 2z" />
    </svg>
  );
}

type Option = { value: string; label: string };

function FilterHeader({
  title, options, selected, onChange,
}: { title: string; options: Option[]; selected: Set<string>; onChange: (s: Set<string>) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const active = selected.size > 0;
  const toggle = (v: string) => {
    const next = new Set(selected);
    next.has(v) ? next.delete(v) : next.add(v);
    onChange(next);
  };
  return (
    <div ref={ref} className="relative inline-flex items-center gap-1">
      <span>{title}</span>
      <button onClick={() => setOpen((o) => !o)} className={`p-0.5 rounded hover:bg-gray-200 ${active ? "bg-brand-50" : ""}`} title={`Filter by ${title.toLowerCase()}`}>
        <Funnel active={active} />
      </button>
      {open && (
        <div className="absolute z-30 top-6 left-0 bg-white border rounded-lg shadow-lg p-2 w-60 max-h-72 overflow-auto text-xs normal-case font-normal text-gray-700">
          <div className="flex justify-between items-center px-1 pb-1.5 mb-1 border-b">
            <span className="text-gray-400">{active ? `${selected.size} selected` : "Show all"}</span>
            {active && <button onClick={() => onChange(new Set())} className="text-brand-600 hover:underline font-medium">Clear</button>}
          </div>
          {options.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 px-1 py-1.5 rounded hover:bg-gray-50 cursor-pointer">
              <input type="checkbox" checked={selected.has(opt.value)} onChange={() => toggle(opt.value)} className="shrink-0" />
              <span className="truncate">{opt.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export function SubmissionsTable({ rows }: { rows: SubRow[] }) {
  const [statusF, setStatusF] = useState<Set<string>>(new Set());
  const [lessonF, setLessonF] = useState<Set<string>>(new Set());
  const [modF, setModF] = useState<Set<string>>(new Set());

  const statusOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.status))).map((s) => ({ value: s, label: STATUS_LABELS[s] ?? s })),
    [rows]
  );
  const lessonOptions = useMemo(() => {
    const m = new Map<string, { order: number; label: string }>();
    rows.forEach((r) => { if (!m.has(r.lessonId)) m.set(r.lessonId, { order: r.lessonOrder, label: r.lessonLabel }); });
    return Array.from(m.entries()).sort((a, b) => a[1].order - b[1].order).map(([id, v]) => ({ value: id, label: v.label }));
  }, [rows]);
  const modOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.reviewer))).sort().map((m) => ({ value: m, label: m })),
    [rows]
  );

  const filtered = rows.filter(
    (r) =>
      (statusF.size === 0 || statusF.has(r.status)) &&
      (lessonF.size === 0 || lessonF.has(r.lessonId)) &&
      (modF.size === 0 || modF.has(r.reviewer))
  );
  const pendingCount = filtered.filter((r) => NEEDS_REVIEW.has(r.status)).length;

  return (
    <div>
      <p className="text-sm text-gray-500 mb-3">
        {filtered.length} submission{filtered.length !== 1 ? "s" : ""}
        {filtered.length !== rows.length && <span className="text-gray-400"> (of {rows.length})</span>}
        {pendingCount > 0 && <span className="ml-2 text-blue-600 font-medium">· {pendingCount} need review</span>}
      </p>

      <div className="bg-white border rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <th className="text-left px-4 py-3">Learner</th>
              <th className="text-left px-4 py-3"><FilterHeader title="Lesson" options={lessonOptions} selected={lessonF} onChange={setLessonF} /></th>
              <th className="text-left px-4 py-3">Assignment</th>
              <th className="text-left px-4 py-3"><FilterHeader title="Moderator" options={modOptions} selected={modF} onChange={setModF} /></th>
              <th className="text-right px-4 py-3">Score</th>
              <th className="text-left px-4 py-3"><FilterHeader title="Status" options={statusOptions} selected={statusF} onChange={setStatusF} /></th>
              <th className="text-right px-4 py-3">Submitted</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((r) => {
              const isPending = NEEDS_REVIEW.has(r.status);
              return (
                <tr key={r.id} className={`hover:bg-gray-50 ${isPending ? "bg-blue-50/40" : ""}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{r.learnerName}</td>
                  <td className="px-4 py-3">
                    <span className="text-gray-700">{r.lessonLabel}</span>
                    <span className="block text-xs text-gray-400 truncate">{r.courseTitle}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{r.assignmentTitle}</td>
                  <td className="px-4 py-3 text-xs">
                    {r.reviewer === "Unassigned"
                      ? <span className="text-amber-600">Unassigned</span>
                      : <span className="text-gray-600">👤 {r.reviewer}</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.score != null
                      ? <span className={`font-semibold ${r.score >= 80 ? "text-green-600" : r.score >= 60 ? "text-amber-600" : "text-red-600"}`}>{r.score}</span>
                      : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[r.status] ?? "bg-gray-100 text-gray-500"}`}>
                      {STATUS_LABELS[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-gray-400">{fmtDate(r.submittedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/submissions/${r.id}`} className={`text-xs font-medium hover:underline ${isPending ? "text-blue-600" : "text-brand-600"}`}>
                      {isPending ? "Review →" : "View →"}
                    </Link>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">No submissions match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
