import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { GroupsManager } from "./groups-manager";
import { getCourseReviewers } from "@/lib/course-reviewers";

export const dynamic = "force-dynamic";

export default async function GroupsPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const accessErr = await assertCourseOwner(params.id, user.id);
  if (accessErr) return accessErr;

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  const isManager = profile?.role === "course_manager";
  const canAssignModerator = ["admin", "course_creator"].includes(profile?.role ?? "");
  const reviewers = await getCourseReviewers(admin, params.id);

  // The course's phases, ordered (empty for a course that doesn't use phases —
  // ADR-0003). Drives the phase tabs + which phase a new group is created in.
  const { data: phases } = await admin
    .from("course_phases")
    .select("id, name, ord")
    .eq("course_id", params.id)
    .order("ord");

  // Load groups (managers only see their own)
  let groupQuery = admin
    .from("course_groups")
    .select("id, name, moderator_id, phase_id, created_at, course_group_members(user_id, profiles(id, full_name, email))")
    .eq("course_id", params.id)
    .order("created_at");

  if (isManager) groupQuery = groupQuery.eq("moderator_id", user.id);
  const { data: groups } = await groupQuery;

  // All enrolled learners for this course (the client computes per-phase "unassigned"
  // from the group membership it already receives).
  const { data: enrollments } = await admin
    .from("enrollments")
    .select("user_id, profiles(id, full_name, email)")
    .eq("course_id", params.id);

  // Normalise groups shape
  const normalisedGroups = (groups ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    moderator_id: g.moderator_id,
    phase_id: g.phase_id ?? null,
    members: (g.course_group_members ?? []).map((m: any) => ({
      id: m.user_id,
      name: m.profiles?.full_name || m.profiles?.email || "Unknown",
      email: m.profiles?.email || "",
    })),
  }));

  // All enrolled learners (for add-member lookup including already assigned ones in other groups)
  const allLearners = (enrollments ?? []).map((e) => ({
    id: (e.profiles as any)?.id as string,
    name: (e.profiles as any)?.full_name || (e.profiles as any)?.email || "Unknown",
    email: (e.profiles as any)?.email || "",
  })).filter((l) => l.id);

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Groups</h1>
        <p className="text-sm text-gray-500 mt-1">
          Organise learners into collaborative groups for group assignments.
        </p>
      </div>
      <GroupsManager
        courseId={params.id}
        phases={phases ?? []}
        groups={normalisedGroups}
        allLearners={allLearners}
        reviewers={reviewers}
        canAssignModerator={canAssignModerator}
      />
    </div>
  );
}
