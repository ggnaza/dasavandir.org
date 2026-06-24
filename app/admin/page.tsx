import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BackfillMaterialsButton } from "./backfill-materials-button";

export const dynamic = "force-dynamic";

// Returns Mon 00:00 and Sun 23:59:59 UTC for the current Armenia week (UTC+4)
function getCurrentWeekRangeUTC(): { start: string; end: string } {
  const OFFSET_MS = 4 * 60 * 60 * 1000; // Armenia = UTC+4
  const nowArmenia = new Date(Date.now() + OFFSET_MS);
  const dow = nowArmenia.getUTCDay(); // 0=Sun … 6=Sat
  const daysSinceMon = dow === 0 ? 6 : dow - 1;
  const monArmenia = new Date(nowArmenia);
  monArmenia.setUTCDate(nowArmenia.getUTCDate() - daysSinceMon);
  monArmenia.setUTCHours(0, 0, 0, 0);
  const sunArmenia = new Date(monArmenia);
  sunArmenia.setUTCDate(monArmenia.getUTCDate() + 6);
  sunArmenia.setUTCHours(23, 59, 59, 999);
  return {
    start: new Date(monArmenia.getTime() - OFFSET_MS).toISOString(),
    end: new Date(sunArmenia.getTime() - OFFSET_MS).toISOString(),
  };
}

function formatDuration(ms: number): string {
  const totalMins = Math.round(ms / 60000);
  if (totalMins < 60) return `${totalMins}m`;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default async function AdminDashboard() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const admin = createAdminClient();
    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") redirect("/admin/courses");
  }

  const admin = createAdminClient();
  const { start: weekStart, end: weekEnd } = getCurrentWeekRangeUTC();

  const [
    { count: courseCount },
    { count: learnerCount },
    { count: lessonCount },
    { data: loginLogs },
    { data: courseRows },
    { data: editEvents },
  ] = await Promise.all([
    admin.from("courses").select("*", { count: "exact", head: true }),
    admin.from("profiles").select("*", { count: "exact", head: true }).eq("role", "learner"),
    admin.from("lessons").select("*", { count: "exact", head: true }),
    admin
      .from("audit_logs")
      .select("actor_id")
      .eq("action", "login")
      .gte("created_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()),
    admin
      .from("courses")
      .select("created_by")
      .not("created_by", "is", null),
    // Edit open/save events for the current Mon–Sun week
    admin
      .from("audit_logs")
      .select("actor_id, action, created_at")
      .in("action", ["lesson_edit_open", "lesson_edit_save"])
      .gte("created_at", weekStart)
      .lte("created_at", weekEnd)
      .order("created_at", { ascending: true }),
  ]);

  // ── Collect all unique user IDs for profile lookup ────────
  const loginIds = Array.from(new Set((loginLogs ?? []).map((r) => r.actor_id).filter(Boolean)));
  const creatorIds = Array.from(new Set((courseRows ?? []).map((r) => r.created_by).filter(Boolean)));
  const editIds = Array.from(new Set((editEvents ?? []).map((r) => r.actor_id).filter(Boolean)));
  const allIds = Array.from(new Set([...loginIds, ...creatorIds, ...editIds]));

  const profileMap: Record<string, { full_name: string; role: string }> = {};
  if (allIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name, role")
      .in("id", allIds);
    for (const p of profiles ?? []) {
      profileMap[p.id] = { full_name: p.full_name ?? "Unknown", role: p.role ?? "" };
    }
  }

  // ── Top users by login count ──────────────────────────────
  const loginMap: Record<string, { name: string; role: string; count: number }> = {};
  for (const row of loginLogs ?? []) {
    if (!row.actor_id) continue;
    if (!loginMap[row.actor_id]) {
      loginMap[row.actor_id] = {
        name: profileMap[row.actor_id]?.full_name ?? "Unknown",
        role: profileMap[row.actor_id]?.role ?? "",
        count: 0,
      };
    }
    loginMap[row.actor_id].count++;
  }
  const topByLogins = Object.entries(loginMap)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // ── Top users by courses created ─────────────────────────
  const creatorMap: Record<string, { name: string; role: string; count: number }> = {};
  for (const row of courseRows ?? []) {
    if (!row.created_by) continue;
    if (!creatorMap[row.created_by]) {
      creatorMap[row.created_by] = {
        name: profileMap[row.created_by]?.full_name ?? "Unknown",
        role: profileMap[row.created_by]?.role ?? "",
        count: 0,
      };
    }
    creatorMap[row.created_by].count++;
  }
  const topByCreations = Object.entries(creatorMap)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // ── Top editors by time this week ─────────────────────────
  // Pair each open with the next save by the same user; cap session at 2h.
  const lastOpen: Record<string, number> = {};
  const editTimeMs: Record<string, number> = {};

  for (const ev of editEvents ?? []) {
    if (!ev.actor_id) continue;
    const ts = new Date(ev.created_at).getTime();
    if (ev.action === "lesson_edit_open") {
      lastOpen[ev.actor_id] = ts;
    } else if (ev.action === "lesson_edit_save") {
      const open = lastOpen[ev.actor_id];
      const SESSION_CAP = 2 * 60 * 60 * 1000;
      const duration = open ? Math.min(ts - open, SESSION_CAP) : 10 * 60 * 1000;
      editTimeMs[ev.actor_id] = (editTimeMs[ev.actor_id] ?? 0) + duration;
      delete lastOpen[ev.actor_id];
    }
  }

  const topEditors = Object.entries(editTimeMs)
    .map(([id, ms]) => ({
      id,
      name: profileMap[id]?.full_name ?? "Unknown",
      role: profileMap[id]?.role ?? "",
      ms,
    }))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 5);

  const stats = [
    { label: "Courses", value: courseCount ?? 0, href: "/admin/courses" },
    { label: "Learners", value: learnerCount ?? 0, href: "#" },
    { label: "Lessons", value: lessonCount ?? 0, href: "#" },
  ];

  const ROLE_BADGE: Record<string, string> = {
    admin: "bg-purple-100 text-purple-700",
    course_creator: "bg-blue-100 text-blue-700",
    course_manager: "bg-cyan-100 text-cyan-700",
    learner: "bg-gray-100 text-gray-600",
  };

  // Mon dd Mon format for header
  const monLabel = new Date(new Date(weekStart).getTime() + 4 * 3600000)
    .toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Yerevan" });
  const sunLabel = new Date(new Date(weekEnd).getTime() + 4 * 3600000)
    .toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Yerevan" });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <Link
          href="/admin/courses/new"
          className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 text-sm font-medium"
        >
          + New Course
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="bg-white border rounded-xl p-6 hover:shadow-sm transition"
          >
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className="text-3xl font-bold mt-1">{s.value}</p>
          </Link>
        ))}
      </div>

      {/* ── Most Active Users ─────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">

        {/* By logins */}
        <div className="bg-white border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">🔑</span>
            <div>
              <h2 className="font-semibold text-sm leading-tight">Most Active by Logins</h2>
              <p className="text-xs text-gray-400">Last 90 days</p>
            </div>
          </div>
          {topByLogins.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No login data yet — tracking started today.</p>
          ) : (
            <ol className="space-y-2">
              {topByLogins.map((u, i) => (
                <li key={u.id} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-4 shrink-0">{i + 1}</span>
                  <Link href={`/admin/users/${u.id}/activity`} className="flex-1 text-sm font-medium text-gray-800 hover:text-brand-600 truncate">
                    {u.name}
                  </Link>
                  {u.role && (
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${ROLE_BADGE[u.role] ?? "bg-gray-100 text-gray-600"}`}>
                      {u.role.replace("_", " ")}
                    </span>
                  )}
                  <span className="text-sm font-semibold text-gray-700 shrink-0 w-8 text-right">{u.count}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* By course creations */}
        <div className="bg-white border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">✏️</span>
            <div>
              <h2 className="font-semibold text-sm leading-tight">Most Active by Course Creation</h2>
              <p className="text-xs text-gray-400">All time</p>
            </div>
          </div>
          {topByCreations.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No courses with a creator recorded.</p>
          ) : (
            <ol className="space-y-2">
              {topByCreations.map((u, i) => (
                <li key={u.id} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-4 shrink-0">{i + 1}</span>
                  <Link href={`/admin/users/${u.id}/activity`} className="flex-1 text-sm font-medium text-gray-800 hover:text-brand-600 truncate">
                    {u.name}
                  </Link>
                  {u.role && (
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${ROLE_BADGE[u.role] ?? "bg-gray-100 text-gray-600"}`}>
                      {u.role.replace("_", " ")}
                    </span>
                  )}
                  <span className="text-sm font-semibold text-gray-700 shrink-0 text-right">
                    {u.count} {u.count === 1 ? "course" : "courses"}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* By editing time this week */}
        <div className="bg-white border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">⏱️</span>
            <div>
              <h2 className="font-semibold text-sm leading-tight">Most Time Editing</h2>
              <p className="text-xs text-gray-400">This week · {monLabel} – {sunLabel}</p>
            </div>
          </div>
          {topEditors.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No editing sessions recorded this week yet.</p>
          ) : (
            <ol className="space-y-2">
              {topEditors.map((u, i) => (
                <li key={u.id} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-4 shrink-0">{i + 1}</span>
                  <Link href={`/admin/users/${u.id}/activity`} className="flex-1 text-sm font-medium text-gray-800 hover:text-brand-600 truncate">
                    {u.name}
                  </Link>
                  {u.role && (
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${ROLE_BADGE[u.role] ?? "bg-gray-100 text-gray-600"}`}>
                      {u.role.replace("_", " ")}
                    </span>
                  )}
                  <span className="text-sm font-semibold text-brand-600 shrink-0">{formatDuration(u.ms)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

      </div>

      {/* Studio banner */}
      <Link
        href="/admin/studio"
        className="flex items-center gap-4 bg-brand-600 text-white rounded-xl p-5 mb-4 hover:bg-brand-700 transition"
      >
        <span className="text-3xl shrink-0">🎛️</span>
        <div>
          <p className="font-semibold">Creation Studio</p>
          <p className="text-brand-100 text-sm">AI builder · Manual courses · Audio narration · Drive import</p>
        </div>
        <span className="ml-auto text-brand-200 text-lg">→</span>
      </Link>

      <div className="bg-white border rounded-xl p-6">
        <h2 className="font-semibold mb-2">Quick links</h2>
        <ul className="space-y-2 text-sm text-brand-600">
          <li><Link href="/admin/courses" className="hover:underline">→ Manage courses</Link></li>
          <li><Link href="/admin/learners" className="hover:underline">→ Learner management</Link></li>
          <li><Link href="/admin/users" className="hover:underline">→ Manage users & roles</Link></li>
          <li><Link href="/admin/analytics" className="hover:underline">→ View analytics</Link></li>
        </ul>
      </div>

      <div className="bg-white border rounded-xl p-6 mt-4">
        <h2 className="font-semibold mb-1">AI Coach materials</h2>
        <p className="text-xs text-gray-500 mb-3">First-time setup or after adding new slides/PDFs to existing lessons.</p>
        <BackfillMaterialsButton />
      </div>
    </div>
  );
}
