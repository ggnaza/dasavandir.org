import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { getModeratorCohort } from "@/lib/get-moderator-cohort";
import { clampSessionSeconds } from "@/lib/session-time";

export const dynamic = "force-dynamic";

function formatDate(iso: string | null) {
  if (!iso) return "—";
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

type CoachStats = { sessions: number; messages: number; durationSeconds: number; lastActive: string | null; lessonIds: Set<string> };
function engagementLevel(stats: CoachStats | undefined): "none" | "low" | "medium" | "high" {
  if (!stats || stats.sessions === 0) return "none";
  if (stats.sessions >= 6 || stats.messages >= 26) return "high";
  if (stats.sessions >= 3 || stats.messages >= 10) return "medium";
  return "low";
}
const engagementBadge = {
  none:   { label: "None",   cls: "bg-gray-100 text-gray-400" },
  low:    { label: "Low",    cls: "bg-yellow-100 text-yellow-700" },
  medium: { label: "Medium", cls: "bg-blue-100 text-blue-700" },
  high:   { label: "High",   cls: "bg-green-100 text-green-700" },
};

// AI Coach → Usage: engagement (sessions/messages/level), the AI's per-learner
// memory summaries, and platform activity (time on platform + last active).
export default async function AiCoachUsagePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return notFound();

  const accessErr = await assertCourseOwner(params.id, user.id);
  if (accessErr) return accessErr;

  const { data: viewerProfile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  const cohortIds = await getModeratorCohort(user.id, params.id, viewerProfile?.role ?? "");
  const isCohortLimited = cohortIds !== null;

  const { data: course } = await admin.from("courses").select("id, title").eq("id", params.id).single();
  if (!course) notFound();

  const { data: lessons } = await admin.from("lessons").select("id, title, order").eq("course_id", params.id).order("order");
  const lessonIds = (lessons ?? []).map((l) => l.id);
  const lessonMap = Object.fromEntries((lessons ?? []).map((l) => [l.id, l]));

  const [{ data: allEnrollments }, { data: aiMemory }, { data: lastSessions }, { data: coachSessions }] = await Promise.all([
    admin.from("enrollments").select("user_id").eq("course_id", params.id),
    admin.from("ai_coach_memory").select("user_id, summary, updated_at").eq("course_id", params.id),
    lessonIds.length > 0
      ? admin.from("lesson_sessions").select("user_id, duration_seconds, created_at").in("lesson_id", lessonIds)
      : Promise.resolve({ data: [] }),
    admin.from("ai_coach_sessions").select("user_id, lesson_id, started_at, last_message_at, message_count").eq("course_id", params.id),
  ]);

  const enrollments = cohortIds !== null
    ? (allEnrollments ?? []).filter((e) => cohortIds.includes(e.user_id))
    : (allEnrollments ?? []);
  const userIds = enrollments.map((e) => e.user_id);

  const { data: profiles } = userIds.length > 0
    ? await admin.from("profiles").select("id, full_name, email").in("id", userIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

  const memoryMap = Object.fromEntries((aiMemory ?? []).map((m) => [m.user_id, { summary: m.summary as string, updated_at: m.updated_at as string }]));

  const coachStatsMap: Record<string, CoachStats> = {};
  for (const s of coachSessions ?? []) {
    if (!coachStatsMap[s.user_id]) coachStatsMap[s.user_id] = { sessions: 0, messages: 0, durationSeconds: 0, lastActive: null, lessonIds: new Set() };
    const stats = coachStatsMap[s.user_id];
    stats.sessions += 1;
    stats.messages += s.message_count ?? 0;
    if (s.started_at && s.last_message_at) {
      stats.durationSeconds += Math.max(0, Math.round((new Date(s.last_message_at).getTime() - new Date(s.started_at).getTime()) / 1000));
    }
    if (!stats.lastActive || (s.last_message_at && s.last_message_at > stats.lastActive)) stats.lastActive = s.last_message_at;
    if (s.lesson_id) stats.lessonIds.add(s.lesson_id);
  }

  const lastActivityMap: Record<string, string | null> = {};
  const totalTimeMap: Record<string, number> = {};
  for (const s of lastSessions ?? []) {
    if (!lastActivityMap[s.user_id] || s.created_at > (lastActivityMap[s.user_id] ?? "")) lastActivityMap[s.user_id] = s.created_at;
    totalTimeMap[s.user_id] = (totalTimeMap[s.user_id] ?? 0) + clampSessionSeconds(s.duration_seconds);
  }

  const rows = userIds.map((uid) => ({
    uid,
    name: profileMap[uid]?.full_name ?? profileMap[uid]?.email ?? uid,
    lastActivity: lastActivityMap[uid] ?? null,
    totalTime: totalTimeMap[uid] ?? 0,
  })).sort((a, b) => {
    if (!a.lastActivity && !b.lastActivity) return 0;
    if (!a.lastActivity) return 1;
    if (!b.lastActivity) return -1;
    return b.lastActivity.localeCompare(a.lastActivity);
  });

  const activeUsers = userIds.filter((uid) => (coachStatsMap[uid]?.sessions ?? 0) > 0).length;
  const totalSessions = Object.values(coachStatsMap).reduce((s, c) => s + c.sessions, 0);
  const totalMessages = Object.values(coachStatsMap).reduce((s, c) => s + c.messages, 0);
  const highEngagement = userIds.filter((uid) => engagementLevel(coachStatsMap[uid]) === "high").length;
  const learnersWithMemory = rows.filter((r) => memoryMap[r.uid]?.summary?.trim());

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-xl font-bold mb-1">AI Coach usage</h2>
        <p className="text-sm text-gray-500">
          Engagement, the coach&apos;s per-learner memory, and platform activity for {course.title}.
          {isCohortLimited && <span className="ml-2 text-blue-600 font-medium">Showing your cohort.</span>}
        </p>
      </div>

      {/* Engagement summary */}
      <section>
        <div className="grid grid-cols-4 gap-3 mb-5">
          <div className="bg-white border rounded-xl p-4 text-center">
            <p className="text-xs text-gray-500">Active users</p>
            <p className="text-2xl font-bold mt-1">{activeUsers}<span className="text-sm text-gray-400 font-normal">/{userIds.length}</span></p>
          </div>
          <div className="bg-white border rounded-xl p-4 text-center">
            <p className="text-xs text-gray-500">Total sessions</p>
            <p className="text-2xl font-bold mt-1">{totalSessions}</p>
          </div>
          <div className="bg-white border rounded-xl p-4 text-center">
            <p className="text-xs text-gray-500">Total messages</p>
            <p className="text-2xl font-bold mt-1">{totalMessages}</p>
          </div>
          <div className="bg-white border rounded-xl p-4 text-center">
            <p className="text-xs text-gray-500">High engagement</p>
            <p className="text-2xl font-bold mt-1 text-green-600">{highEngagement}</p>
          </div>
        </div>

        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50 grid grid-cols-12 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <span className="col-span-3">Learner</span>
            <span className="col-span-2 text-center">Engagement</span>
            <span className="col-span-1 text-right">Sessions</span>
            <span className="col-span-1 text-right">Messages</span>
            <span className="col-span-2 text-right">Lessons used</span>
            <span className="col-span-1 text-right">Time</span>
            <span className="col-span-2 text-right">Last active</span>
          </div>
          {rows.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-400 text-center">No learners enrolled.</p>
          ) : (
            <div className="divide-y">
              {rows.map((r) => {
                const stats = coachStatsMap[r.uid];
                const level = engagementLevel(stats);
                const badge = engagementBadge[level];
                return (
                  <div key={r.uid} className="px-5 py-3 grid grid-cols-12 items-start text-sm">
                    <span className="col-span-3 font-medium text-gray-800 truncate pt-0.5">{r.name}</span>
                    <span className="col-span-2 text-center pt-0.5">
                      <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>
                        {level === "high" && "✦ "}{badge.label}
                      </span>
                    </span>
                    <span className="col-span-1 text-right text-xs text-gray-600 tabular-nums pt-0.5">{stats?.sessions ?? 0}</span>
                    <span className="col-span-1 text-right text-xs text-gray-600 tabular-nums pt-0.5">{stats?.messages ?? 0}</span>
                    <span className="col-span-2 text-right text-xs text-gray-500">
                      {stats && stats.lessonIds.size > 0
                        ? Array.from(stats.lessonIds).map((lid) => (
                            <span key={lid} className="block truncate" title={lessonMap[lid]?.title}>
                              {lessonMap[lid] ? `M${lessonMap[lid].order}` : "—"}
                            </span>
                          ))
                        : <span className="text-gray-300">—</span>}
                    </span>
                    <span className="col-span-1 text-right text-xs text-gray-500 tabular-nums pt-0.5">
                      {stats && stats.durationSeconds > 0 ? formatTime(stats.durationSeconds) : "—"}
                    </span>
                    <span className="col-span-2 text-right text-xs text-gray-400 pt-0.5">{formatDate(stats?.lastActive ?? null)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* AI memory summaries */}
      <section>
        <h3 className="text-base font-semibold mb-1">What the coach knows about each learner</h3>
        <p className="text-xs text-gray-400 mb-4">
          The AI&apos;s running summary of each learner&apos;s conversations — topics they struggled with, what they understand, and their style. Generated by the coach; chat transcripts are never stored.
        </p>
        {learnersWithMemory.length === 0 ? (
          <div className="bg-white border rounded-xl p-8 text-center text-gray-400 text-sm">No coach memory yet.</div>
        ) : (
          <div className="space-y-4">
            {learnersWithMemory.map((r) => (
              <div key={r.uid} className="bg-white border rounded-xl overflow-hidden">
                <div className="px-5 py-2.5 border-b bg-gray-50 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-800 truncate">{r.name}</span>
                  <span className="text-xs text-gray-400 shrink-0">Updated {formatDate(memoryMap[r.uid]?.updated_at ?? null)}</span>
                </div>
                <p className="px-5 py-3 text-sm text-gray-700 whitespace-pre-wrap">{memoryMap[r.uid]?.summary}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Platform activity */}
      <section>
        <h3 className="text-base font-semibold mb-1">Platform activity</h3>
        <p className="text-xs text-gray-400 mb-4">Active time and last activity per learner (from lesson sessions).</p>
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50 grid grid-cols-12 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <span className="col-span-5">Learner</span>
            <span className="col-span-4 text-right">Time on platform</span>
            <span className="col-span-3 text-right">Last active</span>
          </div>
          {rows.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-400 text-center">No learners enrolled.</p>
          ) : (
            <div className="divide-y">
              {rows.map((r) => (
                <div key={r.uid} className="px-5 py-3 grid grid-cols-12 items-center text-sm">
                  <span className="col-span-5 font-medium text-gray-800 truncate">{r.name}</span>
                  <span className="col-span-4 text-right text-xs text-gray-600">{formatTime(r.totalTime)}</span>
                  <span className="col-span-3 text-right text-xs text-gray-400">{formatDate(r.lastActivity)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
