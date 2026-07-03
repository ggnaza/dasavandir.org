import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { getModeratorCohort } from "@/lib/get-moderator-cohort";

export const dynamic = "force-dynamic";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// Analytics → Reflections: learner journal entries (previously only visible to
// the learner). Read here via the service-role client for course staff.
export default async function ReflectionsPage({ params }: { params: { id: string } }) {
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

  const { data: reflections } = await admin
    .from("reflections")
    .select("id, user_id, content, created_at")
    .eq("course_id", params.id)
    .order("created_at", { ascending: false });

  // Scope moderators to their cohort.
  const visibleReflections = cohortIds !== null
    ? (reflections ?? []).filter((r) => cohortIds.includes(r.user_id))
    : (reflections ?? []);

  const userIds = Array.from(new Set(visibleReflections.map((r) => r.user_id)));
  const { data: profiles } = userIds.length > 0
    ? await admin.from("profiles").select("id, full_name, email").in("id", userIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

  const byLearner = new Map<string, { name: string; email: string; entries: { id: string; content: string; created_at: string }[] }>();
  for (const r of visibleReflections) {
    const p = profileMap[r.user_id];
    if (!byLearner.has(r.user_id)) {
      byLearner.set(r.user_id, {
        name: p?.full_name || p?.email || "Unknown",
        email: p?.email ?? "",
        entries: [],
      });
    }
    byLearner.get(r.user_id)!.entries.push({ id: r.id, content: r.content, created_at: r.created_at });
  }

  const learners = Array.from(byLearner.values()).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">Reflections</h2>
        <p className="text-sm text-gray-500">
          Learner journal entries for {course.title}.
          {isCohortLimited && (
            <span className="ml-2 text-blue-600 font-medium">Showing your cohort.</span>
          )}
        </p>
      </div>

      {learners.length === 0 ? (
        <div className="bg-white border rounded-xl p-10 text-center text-gray-400 text-sm">
          No reflections yet.
        </div>
      ) : (
        <div className="space-y-5">
          {learners.map((l) => (
            <div key={l.email + l.name} className="bg-white border rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{l.name}</p>
                  {l.email && <p className="text-xs text-gray-400 truncate">{l.email}</p>}
                </div>
                <span className="text-xs text-gray-400 shrink-0">
                  {l.entries.length} entr{l.entries.length !== 1 ? "ies" : "y"}
                </span>
              </div>
              <ul className="divide-y">
                {l.entries.map((e) => (
                  <li key={e.id} className="px-5 py-3">
                    <p className="text-xs text-gray-400 mb-1">{formatDate(e.created_at)}</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{e.content}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
