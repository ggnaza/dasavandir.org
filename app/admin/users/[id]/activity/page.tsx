import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { headers } from "next/headers";
import { moduleUrl } from "@/lib/modules";

export const dynamic = "force-dynamic";

// Armenia is UTC+4 year-round (no DST)
function toArmenianTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Yerevan",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ACTION_LABELS: Record<string, string> = {
  login: "Logged in",
  login_failed: "Failed login attempt",
  update_role: "Role updated",
  create_user: "Created a user",
  delete_user: "Deleted a user",
  bulk_enroll: "Bulk enrolled learners",
  bulk_unenroll: "Bulk unenrolled learners",
  bulk_delete_users: "Bulk deleted users",
  invite_users: "Invited users",
  delete_invitation: "Deleted invitation",
  export_learners: "Exported learner data",
  review_submission: "Reviewed a submission",
  review_capstone: "Reviewed a capstone",
  delete_course: "Deleted a course",
  unenroll_learner: "Unenrolled a learner",
  suspend_learner: "Suspended a learner",
  reactivate_learner: "Reactivated a learner",
};

const ACTION_ICON: Record<string, string> = {
  login: "🔑",
  login_failed: "⚠️",
  update_role: "🔧",
  create_user: "👤",
  delete_user: "🗑️",
  bulk_enroll: "📋",
  bulk_unenroll: "📋",
  bulk_delete_users: "🗑️",
  invite_users: "✉️",
  delete_invitation: "✉️",
  export_learners: "📤",
  review_submission: "📝",
  review_capstone: "🎓",
  delete_course: "🗑️",
  unenroll_learner: "➖",
  suspend_learner: "⏸️",
  reactivate_learner: "▶️",
};

type EfficacyScores = {
  observations_sent: number;
  observation_avg: number | null;
  last_observation_at: string | null;
  latest_competency_avg: number | null;
  latest_competency_at: string | null;
  reflections_count: number;
  ai_evaluation_accepted_avg: number | null;
};

/**
 * The person's scores in the Efficacy tool, from the read-only cross-tool view
 * `public.efficacy_teacher_scores_v` (shipped by the Efficacy repo's migrations, ADR-0009 §5).
 * Null — and the section is hidden — when they have no Efficacy access or the view isn't applied.
 */
async function getEfficacyScores(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<EfficacyScores | null> {
  const { data, error } = await admin
    .from("efficacy_teacher_scores_v")
    .select(
      "observations_sent, observation_avg, last_observation_at, latest_competency_avg, latest_competency_at, reflections_count, ai_evaluation_accepted_avg"
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as EfficacyScores;
}

const score = (v: number | string | null) => (v === null || v === undefined ? "—" : `${Number(v).toFixed(2)} / 5`);

export default async function UserActivityPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const admin = createAdminClient();

  const { data: currentUser } = await supabase.auth.getUser();
  if (!currentUser.user) return <div>Unauthorized</div>;

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", currentUser.user.id)
    .single();

  if (currentProfile?.role !== "admin") return <div>Unauthorized</div>;

  const { data: user } = await admin
    .from("profiles")
    .select("full_name, role, created_at")
    .eq("id", params.id)
    .single();

  const [{ data: logs }, { data: { user: authUser } }, efficacy] = await Promise.all([
    admin
      .from("audit_logs")
      .select("id, action, meta, created_at")
      .eq("actor_id", params.id)
      .order("created_at", { ascending: false })
      .limit(200),
    admin.auth.admin.getUserById(params.id),
    getEfficacyScores(admin, params.id),
  ]);
  const efficacyUrl = moduleUrl("efficacy", headers().get("host") ?? "");

  const lastSignInAt: string | null = authUser?.last_sign_in_at ?? null;
  const loginLogs = (logs ?? []).filter((l) => l.action === "login");
  const otherLogs = (logs ?? []).filter((l) => l.action !== "login");

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <Link href="/admin/users" className="text-brand-600 hover:underline text-sm mb-4 inline-block">
          ← Back to Users
        </Link>
        <h1 className="text-2xl font-bold">{user?.full_name || "User"}</h1>
        <p className="text-gray-500 text-sm mt-1">
          Role: <span className="font-medium capitalize">{user?.role?.replace("_", " ")}</span>
          {" · "}
          Joined: <span className="font-medium">{user?.created_at ? toArmenianTime(user.created_at) : "—"}</span>
        </p>
      </div>

      {/* ── Efficacy tool scores ──────────────────────────── */}
      {efficacy && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Efficacy tool</h2>
            {efficacyUrl && (
              <a href={efficacyUrl} className="text-brand-600 hover:underline text-xs" target="_blank" rel="noopener noreferrer">
                Open Efficacy →
              </a>
            )}
          </div>
          <div className="bg-white border rounded-xl grid grid-cols-2 sm:grid-cols-3 divide-x divide-y">
            <div className="px-5 py-4">
              <p className="text-xs text-gray-500">Observations sent</p>
              <p className="text-lg font-semibold">{efficacy.observations_sent}</p>
              <p className="text-xs text-gray-400">
                {efficacy.last_observation_at ? `Last: ${toArmenianTime(efficacy.last_observation_at)}` : "None yet"}
              </p>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs text-gray-500">Observation average</p>
              <p className="text-lg font-semibold">{score(efficacy.observation_avg)}</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs text-gray-500">Latest competency average</p>
              <p className="text-lg font-semibold">{score(efficacy.latest_competency_avg)}</p>
              <p className="text-xs text-gray-400">
                {efficacy.latest_competency_at ? toArmenianTime(efficacy.latest_competency_at) : "Not evaluated yet"}
              </p>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs text-gray-500">Reflections</p>
              <p className="text-lg font-semibold">{efficacy.reflections_count}</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs text-gray-500">Accepted AI evaluations (avg)</p>
              <p className="text-lg font-semibold">{score(efficacy.ai_evaluation_accepted_avg)}</p>
            </div>
          </div>
        </section>
      )}

      {/* ── Login history ─────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Login history
          <span className="ml-2 text-xs font-normal text-gray-400">({loginLogs.length} total)</span>
        </h2>

        <div className="bg-white border rounded-xl overflow-hidden">
          {loginLogs.length === 0 ? (
            <div className="px-5 py-6 text-center">
              {lastSignInAt ? (
                <>
                  <p className="text-sm text-gray-500">
                    Last seen: <span className="font-medium text-gray-700">{toArmenianTime(lastSignInAt)}</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Full login history is tracked from today onward.</p>
                </>
              ) : (
                <p className="text-sm text-gray-400">No logins recorded yet.</p>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {loginLogs.map((log) => (
                <div key={log.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="text-base shrink-0">🔑</span>
                  <div className="flex-1">
                    <p className="text-sm text-gray-800">Logged in</p>
                  </div>
                  <p className="text-xs text-gray-400 whitespace-nowrap">
                    {toArmenianTime(log.created_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Other activity ────────────────────────────────── */}
      {otherLogs.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Other activity</h2>
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="divide-y">
              {otherLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 px-5 py-3">
                  <span className="text-base shrink-0 mt-0.5">{ACTION_ICON[log.action] ?? "•"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800">{ACTION_LABELS[log.action] ?? log.action}</p>
                    {log.meta && Object.keys(log.meta).length > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {Object.entries(log.meta as Record<string, unknown>)
                          .filter(([k]) => !["ip"].includes(k))
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                    {toArmenianTime(log.created_at)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {(logs ?? []).length === 0 && (
        <div className="bg-white border rounded-xl px-5 py-10 text-center text-gray-400 text-sm">
          No activity recorded for this user.
        </div>
      )}
    </div>
  );
}
