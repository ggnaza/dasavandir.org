import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Log = { id: string; action: string; actor_id: string | null; meta: any; created_at: string };

const ICONS: Record<string, string> = {
  login: "🔑", login_failed: "⚠️", create_user: "👤", update_role: "🔧", delete_user: "🗑️",
  bulk_delete_users: "🗑️", export_learners: "📤", bulk_enroll: "➕", bulk_unenroll: "➖",
  unenroll_learner: "➖", invite_users: "✉️", delete_invitation: "✉️", delete_course: "🗑️",
  review_submission: "📝", review_capstone: "🎓",
};

function describe(log: Log, actor: string): string {
  const m = log.meta ?? {};
  switch (log.action) {
    case "bulk_enroll": return `${actor} enrolled ${m.count ?? "?"} learner${m.count === 1 ? "" : "s"}`;
    case "bulk_unenroll": return `${actor} unenrolled ${m.count ?? "?"} learner${m.count === 1 ? "" : "s"}`;
    case "unenroll_learner": return `${actor} unenrolled a learner`;
    case "invite_users": return `${actor} invited ${m.count ?? "?"} learner${m.count === 1 ? "" : "s"}`;
    case "delete_invitation": return `${actor} deleted a pending invitation`;
    case "delete_course": return `${actor} deleted this course`;
    case "review_submission": return `${actor} reviewed a submission${m.action ? ` (${m.action})` : ""}`;
    case "review_capstone": return `${actor} reviewed a capstone${m.action ? ` (${m.action})` : ""}`;
    case "create_user": return `${actor} created ${m.email ?? "a user"}${m.role ? ` (${m.role})` : ""}`;
    case "update_role": return `${actor} changed a user's role${m.new_role ? ` to ${m.new_role}` : ""}`;
    case "delete_user": return `${actor} deleted a user`;
    case "bulk_delete_users": return `${actor} bulk-deleted ${m.count ?? "?"} users`;
    case "export_learners": return `${actor} exported learner data`;
    case "login": return `${actor} logged in`;
    case "login_failed": return `Failed login attempt${m.email ? ` for ${m.email}` : ""}`;
    default: return `${actor} — ${log.action}`;
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// Main feed excludes successful logins (high-volume, low-signal) and lesson-edit
// tracking (used only for the dashboard "time editing" metric). login_failed is kept.
const EXCLUDE_MAIN = "(login,lesson_edit_open,lesson_edit_save)";

export default async function AuditPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role ?? "";
  if (!["admin", "course_creator"].includes(role)) redirect("/learn");
  const isAdmin = role === "admin";

  // Which courses this user may see (admins: all).
  let accessibleIds: Set<string> | null = null;
  if (!isAdmin) {
    const [{ data: created }, { data: access }] = await Promise.all([
      admin.from("courses").select("id").eq("created_by", user.id),
      admin.from("course_creator_access").select("course_id").eq("creator_id", user.id),
    ]);
    accessibleIds = new Set([
      ...(created ?? []).map((c) => c.id),
      ...(access ?? []).map((a) => a.course_id),
    ]);
  }

  // Meaningful events (everything but login-success + edit tracking).
  const { data: mainLogs } = await admin
    .from("audit_logs")
    .select("id, action, actor_id, meta, created_at")
    .not("action", "in", EXCLUDE_MAIN)
    .order("created_at", { ascending: false })
    .limit(1500);

  // Admins also get recent successful logins in the General section.
  let loginLogs: Log[] = [];
  if (isAdmin) {
    const { data } = await admin
      .from("audit_logs")
      .select("id, action, actor_id, meta, created_at")
      .eq("action", "login")
      .order("created_at", { ascending: false })
      .limit(200);
    loginLogs = (data ?? []) as Log[];
  }

  const allLogs: Log[] = [...((mainLogs ?? []) as Log[]), ...loginLogs];

  const byCourse = new Map<string, Log[]>();
  const general: Log[] = [];
  for (const log of allLogs) {
    const cid: string | null = log.meta?.course_id ?? null;
    if (cid) {
      if (!isAdmin && !accessibleIds!.has(cid)) continue; // creators: only their courses
      if (!byCourse.has(cid)) byCourse.set(cid, []);
      byCourse.get(cid)!.push(log);
    } else if (isAdmin) {
      general.push(log); // platform-wide events — admins only
    }
  }

  // Resolve actor names + course titles.
  const actorIds = Array.from(new Set(allLogs.map((l) => l.actor_id).filter(Boolean))) as string[];
  const courseIds = Array.from(byCourse.keys());
  const [{ data: actors }, { data: courses }] = await Promise.all([
    actorIds.length > 0 ? admin.from("profiles").select("id, full_name, email").in("id", actorIds) : Promise.resolve({ data: [] }),
    courseIds.length > 0 ? admin.from("courses").select("id, title").in("id", courseIds) : Promise.resolve({ data: [] }),
  ]);
  const actorMap = Object.fromEntries((actors ?? []).map((a) => [a.id, a.full_name || a.email || "Unknown"]));
  const courseTitleMap = Object.fromEntries((courses ?? []).map((c) => [c.id, c.title]));
  const actorName = (id: string | null) => (id ? (actorMap[id] ?? "Unknown") : "System");

  const courseSections = Array.from(byCourse.entries())
    .map(([cid, logs]) => ({ cid, title: courseTitleMap[cid] ?? "(deleted course)", logs }))
    .sort((a, b) => a.title.localeCompare(b.title));

  const EventList = ({ logs }: { logs: Log[] }) => (
    <ul className="divide-y">
      {logs.map((log) => (
        <li key={log.id} className="px-5 py-2.5 flex items-start gap-3 text-sm">
          <span className="shrink-0 pt-0.5">{ICONS[log.action] ?? "•"}</span>
          <span className="flex-1 min-w-0 text-gray-700">{describe(log, actorName(log.actor_id))}</span>
          <span className="shrink-0 text-xs text-gray-400" title={new Date(log.created_at).toLocaleString()}>
            {timeAgo(log.created_at)}
          </span>
        </li>
      ))}
    </ul>
  );

  const hasAny = general.length > 0 || courseSections.length > 0;

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Activity Log</h1>
        <p className="text-sm text-gray-500 mt-1">
          {isAdmin
            ? "Sensitive actions across the platform, grouped by course. Recent activity."
            : "Recent activity on your courses."}
        </p>
      </div>

      {!hasAny ? (
        <div className="bg-white border rounded-xl p-10 text-center text-gray-400">No recent activity.</div>
      ) : (
        <div className="space-y-6">
          {isAdmin && general.length > 0 && (
            <section className="bg-white border rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b bg-gray-50">
                <h2 className="text-sm font-bold text-gray-800">General · platform-wide</h2>
                <p className="text-xs text-gray-400">Logins, user & role changes, data exports</p>
              </div>
              <EventList logs={general} />
            </section>
          )}

          {courseSections.map((s) => (
            <section key={s.cid} className="bg-white border rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-800">{s.title}</h2>
                {courseTitleMap[s.cid] && (
                  <Link href={`/admin/courses/${s.cid}`} className="text-xs text-brand-600 hover:underline">
                    Open course →
                  </Link>
                )}
              </div>
              <EventList logs={s.logs} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
