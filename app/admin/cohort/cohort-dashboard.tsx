"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { SendMessageDialog } from "@/app/admin/components/send-message-dialog";

export type CohortLearner = {
  userId: string;
  name: string;
  email: string;
  salesforce_url: string | null;
  courseId: string;
  courseTitle: string;
  pct: number;
  completedCount: number;
  totalLessons: number;
  avgQuiz: number | null;
  submittedCount: number;
  totalAssignments: number;
};

type Props = {
  learners: CohortLearner[];
  courses: { id: string; title: string }[];
};

function ScorePill({ value }: { value: number | null }) {
  if (value === null) return <span className="text-gray-300 text-xs">—</span>;
  const cls =
    value >= 80
      ? "bg-green-100 text-green-700"
      : value >= 60
      ? "bg-yellow-100 text-yellow-700"
      : "bg-red-100 text-red-700";
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{value}%</span>;
}

function ProgressBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? "bg-green-500" : pct >= 40 ? "bg-blue-500" : "bg-gray-300";
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 tabular-nums">{pct}%</span>
    </div>
  );
}

function SalesforceCell({
  userId,
  initial,
}: {
  userId: string;
  initial: string | null;
}) {
  const [url, setUrl] = useState(initial ?? "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    await fetch("/api/admin/learner/salesforce", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, salesforce_url: url.trim() }),
    });
    setSaving(false);
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!editing && !url) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-gray-400 hover:text-brand-600 hover:underline"
      >
        + Add Salesforce
      </button>
    );
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-1.5">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline truncate max-w-[110px]"
          title={url}
        >
          ↗ Salesforce
        </a>
        <button onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:text-gray-600">
          ✎
        </button>
        {saved && <span className="text-xs text-green-600">Saved</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        autoFocus
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setEditing(false);
        }}
        placeholder="https://..."
        className="text-xs border rounded px-2 py-1 w-36 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      <button
        onClick={save}
        disabled={saving}
        className="text-xs bg-brand-600 text-white px-2 py-1 rounded hover:bg-brand-700 disabled:opacity-50"
      >
        {saving ? "…" : "Save"}
      </button>
      <button onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-600">
        ✕
      </button>
    </div>
  );
}

export function CohortDashboard({ learners, courses }: Props) {
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<"name" | "pct" | "quiz" | "submitted">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const filtered = useMemo(() => {
    let rows = [...learners];

    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q)
      );
    }

    if (courseFilter !== "all") {
      rows = rows.filter((r) => r.courseId === courseFilter);
    }

    if (statusFilter === "completed") rows = rows.filter((r) => r.pct === 100);
    else if (statusFilter === "in_progress") rows = rows.filter((r) => r.pct > 0 && r.pct < 100);
    else if (statusFilter === "not_started") rows = rows.filter((r) => r.pct === 0);

    rows.sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;
      if (sortKey === "name") { aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); }
      else if (sortKey === "pct") { aVal = a.pct; bVal = b.pct; }
      else if (sortKey === "quiz") { aVal = a.avgQuiz ?? -1; bVal = b.avgQuiz ?? -1; }
      else if (sortKey === "submitted") {
        aVal = a.totalAssignments > 0 ? a.submittedCount / a.totalAssignments : -1;
        bVal = b.totalAssignments > 0 ? b.submittedCount / b.totalAssignments : -1;
      }

      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return rows;
  }, [learners, search, courseFilter, statusFilter, sortKey, sortDir]);

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const SortIcon = ({ k }: { k: typeof sortKey }) =>
    sortKey === k ? (
      <span className="ml-1 text-brand-600">{sortDir === "asc" ? "↑" : "↓"}</span>
    ) : (
      <span className="ml-1 text-gray-300">↕</span>
    );

  const completedCount = learners.filter((l) => l.pct === 100).length;
  const avgProgress =
    learners.length > 0
      ? Math.round(learners.reduce((s, l) => s + l.pct, 0) / learners.length)
      : 0;
  const avgQuizAll =
    learners.filter((l) => l.avgQuiz !== null).length > 0
      ? Math.round(
          learners.filter((l) => l.avgQuiz !== null).reduce((s, l) => s + l.avgQuiz!, 0) /
            learners.filter((l) => l.avgQuiz !== null).length
        )
      : null;

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Cohort</h1>
        <p className="text-sm text-gray-500 mt-1">
          Teacher-leaders assigned to you across all your courses.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border rounded-xl p-5">
          <p className="text-sm text-gray-500">Total learners</p>
          <p className="text-3xl font-bold mt-1">{learners.length}</p>
        </div>
        <div className="bg-white border rounded-xl p-5">
          <p className="text-sm text-gray-500">Avg progress</p>
          <p className="text-3xl font-bold mt-1">{avgProgress}%</p>
        </div>
        <div className="bg-white border rounded-xl p-5">
          <p className="text-sm text-gray-500">Completed</p>
          <p className="text-3xl font-bold mt-1">{completedCount}</p>
          <p className="text-xs text-gray-400">{learners.length > 0 ? Math.round((completedCount / learners.length) * 100) : 0}% of cohort</p>
        </div>
        <div className="bg-white border rounded-xl p-5">
          <p className="text-sm text-gray-500">Avg quiz score</p>
          <p className="text-3xl font-bold mt-1">{avgQuizAll !== null ? `${avgQuizAll}%` : "—"}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm w-60 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        {courses.length > 1 && (
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="all">All courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        )}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="all">All statuses</option>
          <option value="not_started">Not started</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
        </select>
        <span className="ml-auto text-xs text-gray-400 self-center">
          {filtered.length} of {learners.length} learners
        </span>
      </div>

      {/* Table */}
      {learners.length === 0 ? (
        <div className="bg-white border rounded-xl p-12 text-center text-gray-500">
          No learners have been assigned to your cohort yet. Contact the course administrator.
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border rounded-xl p-8 text-center text-gray-400 text-sm">
          No learners match your filters.
        </div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          {/* Header */}
          <div className="px-5 py-3 border-b bg-gray-50 grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <button
              onClick={() => toggleSort("name")}
              className="col-span-3 text-left flex items-center hover:text-gray-700"
            >
              Learner <SortIcon k="name" />
            </button>
            {courses.length > 1 && (
              <span className="col-span-2">Course</span>
            )}
            <button
              onClick={() => toggleSort("pct")}
              className={`text-left flex items-center hover:text-gray-700 ${courses.length > 1 ? "col-span-2" : "col-span-3"}`}
            >
              Progress <SortIcon k="pct" />
            </button>
            <button
              onClick={() => toggleSort("quiz")}
              className="col-span-2 text-left flex items-center hover:text-gray-700"
            >
              Quiz avg <SortIcon k="quiz" />
            </button>
            <button
              onClick={() => toggleSort("submitted")}
              className="col-span-2 text-left flex items-center hover:text-gray-700"
            >
              Assignments <SortIcon k="submitted" />
            </button>
            <span className="col-span-2">Salesforce</span>
            <span className="col-span-2">Actions</span>
          </div>

          {/* Rows */}
          {filtered.map((r) => (
            <div
              key={`${r.courseId}-${r.userId}`}
              className="px-5 py-4 border-t grid grid-cols-12 gap-2 items-center text-sm hover:bg-gray-50 transition-colors"
            >
              {/* Name */}
              <div className="col-span-3 min-w-0">
                <p className="font-medium text-gray-900 truncate">{r.name}</p>
                <p className="text-xs text-gray-400 truncate">{r.email}</p>
              </div>

              {/* Course */}
              {courses.length > 1 && (
                <div className="col-span-2 min-w-0">
                  <p className="text-xs text-gray-500 truncate" title={r.courseTitle}>
                    {r.courseTitle}
                  </p>
                </div>
              )}

              {/* Progress */}
              <div className={courses.length > 1 ? "col-span-2" : "col-span-3"}>
                <ProgressBar pct={r.pct} />
                <p className="text-xs text-gray-400 mt-0.5">
                  {r.completedCount}/{r.totalLessons} lessons
                </p>
              </div>

              {/* Quiz avg */}
              <div className="col-span-2">
                <ScorePill value={r.avgQuiz} />
              </div>

              {/* Assignments */}
              <div className="col-span-2">
                {r.totalAssignments === 0 ? (
                  <span className="text-xs text-gray-300">—</span>
                ) : (
                  <span className="text-xs text-gray-600">
                    {r.submittedCount}/{r.totalAssignments} submitted
                  </span>
                )}
              </div>

              {/* Salesforce */}
              <div className="col-span-2">
                <SalesforceCell userId={r.userId} initial={r.salesforce_url} />
              </div>

              {/* Actions */}
              <div className="col-span-2 flex items-center justify-end gap-2">
                <SendMessageDialog
                  userId={r.userId}
                  learnerName={r.name.split(" ")[0] || r.name}
                  variant="icon"
                />
                <Link
                  href={`/admin/courses/${r.courseId}/learners/${r.userId}`}
                  className="text-xs text-brand-600 hover:underline font-medium whitespace-nowrap"
                >
                  Details →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
