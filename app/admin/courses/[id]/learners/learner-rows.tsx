"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Learner = {
  userId: string;
  name: string;
  email: string;
  enrolledAt: string;
  status: "active" | "suspended";
  completedCount: number;
  totalLessons: number;
  pct: number;
  completedIds: string[];
  totalSeconds: number;
  online: boolean;
};

type Lesson = {
  id: string;
  title: string;
  order: number;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatTime(seconds: number): string {
  if (seconds === 0) return "—";
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

function StatusDot({ pct }: { pct: number }) {
  const cls = "inline-block w-2.5 h-2.5 rounded-full shrink-0 pointer-events-auto cursor-help";
  if (pct >= 75) return <span className={`${cls} bg-green-500`} title={`On track — ${pct}% of lessons complete`} />;
  if (pct >= 30) return <span className={`${cls} bg-amber-400`} title={`In progress — ${pct}% of lessons complete`} />;
  return <span className={`${cls} bg-red-400`} title={`Needs attention — only ${pct}% of lessons complete`} />;
}

function UnenrollButton({ courseId, learner }: { courseId: string; learner: Learner }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleUnenroll() {
    if (
      !confirm(
        `Remove ${learner.name} from this course? They will lose access but keep their account and progress, and can be re-enrolled later.`
      )
    )
      return;
    setBusy(true);
    const res = await fetch(`/api/admin/courses/${courseId}/enrollments`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: learner.userId }),
    });
    if (!res.ok) {
      alert(`Could not unenroll: ${await res.text()}`);
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <button
      onClick={handleUnenroll}
      disabled={busy}
      className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
      title="Remove from course permanently"
    >
      {busy ? "Removing…" : "Unenroll"}
    </button>
  );
}

function SuspendToggleButton({ courseId, learner }: { courseId: string; learner: Learner }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const suspended = learner.status === "suspended";

  async function handle() {
    const action = suspended ? "reactivate" : "suspend";
    let reason: string | undefined;
    if (suspended) {
      if (!confirm(`Reactivate ${learner.name}? Their course access is restored.`)) return;
    } else {
      const r = prompt(
        `Suspend ${learner.name} from this course? They keep their account, progress, and enrolment date, and lose access until reactivated.\n\nOptional reason:`
      );
      if (r === null) return; // cancelled
      reason = r.trim() || undefined;
    }
    setBusy(true);
    const res = await fetch(`/api/admin/courses/${courseId}/enrollments`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: learner.userId, action, reason }),
    });
    if (!res.ok) {
      alert(`Could not ${action}: ${await res.text()}`);
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <button
      onClick={handle}
      disabled={busy}
      className={`text-xs font-medium disabled:opacity-50 ${
        suspended ? "text-green-600 hover:text-green-700" : "text-amber-600 hover:text-amber-700"
      }`}
      title={suspended ? "Restore course access" : "Suspend course access (keeps all data)"}
    >
      {busy ? "…" : suspended ? "Reactivate" : "Suspend"}
    </button>
  );
}

export function LearnerRows({
  learners,
  lessons,
  courseId,
  canManage = false,
}: {
  learners: Learner[];
  lessons: Lesson[];
  courseId: string;
  canManage?: boolean;
}) {
  return (
    <div className="divide-y">
      {learners.map((l) => (
        <div
          key={l.userId}
          className={`relative grid grid-cols-12 gap-3 items-center px-5 py-4 hover:bg-gray-50 transition text-left ${
            l.status === "suspended" ? "opacity-60" : ""
          }`}
        >
          {/* Full-row link overlay for navigation; interactive controls sit above it. */}
          <Link
            href={`/admin/courses/${courseId}/learners/${l.userId}`}
            aria-label={`View ${l.name}`}
            className="absolute inset-0 z-0"
          />

          <div className="col-span-3 flex items-center gap-2 pointer-events-none">
            <StatusDot pct={l.pct} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate flex items-center gap-2">
                <span className="truncate">{l.name}</span>
                {l.status === "suspended" && (
                  <span
                    className="text-[11px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded shrink-0 pointer-events-auto cursor-help"
                    title="Suspended — no course access; account, progress and enrolment date retained"
                  >
                    suspended
                  </span>
                )}
                {l.online && l.status !== "suspended" && (
                  <span
                    className="text-[11px] font-semibold text-green-600 shrink-0 pointer-events-auto cursor-help"
                    title="Online now — active in the last few minutes"
                  >
                    online
                  </span>
                )}
              </p>
              <p className="text-xs text-gray-400 truncate">{l.email}</p>
            </div>
          </div>

          <div className="col-span-4 pointer-events-none">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-2 rounded-full ${l.pct === 100 ? "bg-green-500" : "bg-brand-500"}`}
                  style={{ width: `${l.pct}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 shrink-0 w-14 text-right">
                {l.completedCount}/{l.totalLessons} {l.pct === 100 ? "✓" : `(${l.pct}%)`}
              </span>
            </div>
          </div>

          <span className="col-span-2 text-xs font-medium text-gray-600 text-right pointer-events-none">
            {formatTime(l.totalSeconds)}
          </span>

          <span className="col-span-2 text-xs text-gray-400 text-right pointer-events-none">
            {l.enrolledAt ? formatDate(l.enrolledAt) : "—"}
          </span>

          <div className="col-span-1 flex flex-col items-end gap-1 relative z-10">
            {canManage ? (
              <>
                <SuspendToggleButton courseId={courseId} learner={l} />
                <UnenrollButton courseId={courseId} learner={l} />
              </>
            ) : (
              <span className="text-gray-400 text-sm pointer-events-none">→</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
