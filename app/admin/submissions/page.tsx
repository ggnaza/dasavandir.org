import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SubmissionsTable, type SubRow } from "./submissions-table";

export const dynamic = "force-dynamic";

const NEEDS_REVIEW = new Set(["submitted", "ai_reviewed", "needs_revision"]);

export default async function SubmissionsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role ?? "";
  if (!["admin", "course_creator", "course_manager"].includes(role)) redirect("/learn");

  // ── Determine which courses + learners are visible ──────────────────────────
  let courseIds: string[] | null = null; // null = all courses
  let learnerIds: string[] | null = null; // null = all learners in those courses

  if (role === "admin") {
    courseIds = null; // all
  } else if (role === "course_creator") {
    const { data: access } = await admin
      .from("course_creator_access")
      .select("course_id")
      .eq("creator_id", user.id);
    courseIds = (access ?? []).map((r) => r.course_id);
  } else {
    // course_manager (moderator): access gate is course_manager_access; the
    // learners they see are the members of the groups they moderate
    // (course_groups.moderator_id → course_group_members), unioned with any
    // legacy moderator_cohort_assignments rows.
    const [{ data: managerAccess }, { data: modGroups }, { data: cohortAssignments }] = await Promise.all([
      admin.from("course_manager_access").select("course_id").eq("manager_id", user.id),
      admin.from("course_groups").select("id").eq("moderator_id", user.id),
      admin.from("moderator_cohort_assignments").select("learner_id").eq("moderator_id", user.id),
    ]);
    courseIds = (managerAccess ?? []).map((r) => r.course_id);

    const groupIds = (modGroups ?? []).map((g) => g.id);
    const { data: groupMembers } = groupIds.length
      ? await admin.from("course_group_members").select("user_id").in("group_id", groupIds)
      : { data: [] as { user_id: string }[] };

    const ids = new Set<string>();
    (groupMembers ?? []).forEach((m: any) => ids.add(m.user_id));
    (cohortAssignments ?? []).forEach((a: any) => ids.add(a.learner_id));
    learnerIds = Array.from(ids);
  }

  // ── Load submissions ────────────────────────────────────────────────────────
  let query = admin
    .from("submissions")
    .select(`
      id, status, ai_total_score, final_score, submitted_at, user_id,
      profiles(full_name, email),
      assignment_id,
      assignments(title, lesson_id,
        lessons(id, title, order, course_id, courses(id, title)))
    `)
    .order("submitted_at", { ascending: false });

  if (courseIds !== null) {
    if (courseIds.length === 0) {
      // no courses visible
      return <EmptyPage message="No courses assigned to you." />;
    }
    // Filter by assignment lesson course
    // We need to filter indirectly — fetch assignment IDs for the courses
    const { data: lessons } = await admin
      .from("lessons")
      .select("id")
      .in("course_id", courseIds);
    const lessonIds = (lessons ?? []).map((l) => l.id);
    if (lessonIds.length === 0) return <EmptyPage message="No lessons in your courses yet." />;

    const { data: assignments } = await admin
      .from("assignments")
      .select("id")
      .in("lesson_id", lessonIds);
    const assignmentIds = (assignments ?? []).map((a) => a.id);
    if (assignmentIds.length === 0) return <EmptyPage message="No assignments in your courses yet." />;

    query = query.in("assignment_id", assignmentIds);
  }

  if (learnerIds !== null) {
    if (learnerIds.length === 0) return <EmptyPage message="No learners in the groups you moderate yet." />;
    query = query.in("user_id", learnerIds);
  }

  const { data: submissions, error: submissionsError } = await query;

  // Surface query failures instead of silently rendering an empty state (a
  // missing column previously made this show "No submissions yet" wrongly).
  if (submissionsError) {
    console.error("[admin/submissions] query failed", submissionsError);
    return <EmptyPage message="Couldn't load submissions. Please try again or contact support." />;
  }

  if (!submissions?.length) {
    return <EmptyPage message="No submissions yet." />;
  }

  // ── Assigned reviewer per (learner, course) = the moderator of the group the
  //    learner belongs to in that course ────────────────────────────────────
  const subCourseIds = Array.from(new Set(
    submissions
      .map((s) => ((s.assignments as any)?.lessons as any)?.courses?.id)
      .filter(Boolean)
  )) as string[];
  const reviewerMap = new Map<string, string>(); // `${userId}:${courseId}` → moderator label
  if (subCourseIds.length > 0) {
    const { data: groups } = await admin
      .from("course_groups")
      .select("id, course_id, moderator_id")
      .in("course_id", subCourseIds);
    const groupList = groups ?? [];
    const groupIds = groupList.map((g) => g.id);
    const modIds = Array.from(new Set(groupList.map((g) => g.moderator_id).filter(Boolean))) as string[];
    const [{ data: members }, { data: mods }] = await Promise.all([
      groupIds.length
        ? admin.from("course_group_members").select("group_id, user_id").in("group_id", groupIds)
        : Promise.resolve({ data: [] as { group_id: string; user_id: string }[] }),
      modIds.length
        ? admin.from("profiles").select("id, full_name, email").in("id", modIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string | null }[] }),
    ]);
    const modName = Object.fromEntries((mods ?? []).map((p: any) => [p.id, p.full_name || p.email || "Moderator"]));
    const groupById = Object.fromEntries(groupList.map((g) => [g.id, g]));
    for (const m of members ?? []) {
      const g = groupById[m.group_id];
      if (!g) continue;
      reviewerMap.set(`${m.user_id}:${g.course_id}`, g.moderator_id ? (modName[g.moderator_id] ?? "Moderator") : "No moderator");
    }
  }

  // Per-submission reviewer overrides (set via "Reassign"). Fetched separately &
  // tolerantly — the reviewer_id column may not exist yet (migration not run).
  const overrideById = new Map<string, string>(); // submissionId → reviewerId
  const { data: overrides } = await admin
    .from("submissions")
    .select("id, reviewer_id")
    .in("id", submissions.map((s) => s.id));
  for (const o of overrides ?? []) {
    if ((o as any).reviewer_id) overrideById.set(o.id, (o as any).reviewer_id);
  }
  const overrideReviewerIds = Array.from(new Set(overrideById.values()));
  const { data: overrideProfiles } = overrideReviewerIds.length > 0
    ? await admin.from("profiles").select("id, full_name, email").in("id", overrideReviewerIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  const overrideName = Object.fromEntries((overrideProfiles ?? []).map((p: any) => [p.id, p.full_name || p.email || "Reviewer"]));

  // Flatten to table rows (pending first, then most recent).
  const rows: SubRow[] = submissions
    .map((sub) => {
      const assignment = sub.assignments as any;
      const lesson = assignment?.lessons as any;
      const course = lesson?.courses as any;
      if (!course || !lesson) return null;
      const p = sub.profiles as any;
      const overrideId = overrideById.get(sub.id);
      const reviewer = overrideId
        ? (overrideName[overrideId] ?? "Reviewer")
        : (reviewerMap.get(`${sub.user_id}:${course.id}`) ?? "Unassigned");
      return {
        id: sub.id,
        learnerName: p?.full_name || p?.email || "Unknown",
        courseId: course.id,
        courseTitle: course.title,
        lessonId: lesson.id,
        lessonLabel: `Module ${lesson.order}: ${lesson.title}`,
        lessonOrder: lesson.order ?? 0,
        assignmentTitle: assignment?.title ?? "",
        reviewer,
        reassigned: !!overrideId,
        score: (sub.final_score ?? sub.ai_total_score) ?? null,
        status: sub.status,
        submittedAt: sub.submitted_at ?? null,
      } as SubRow;
    })
    .filter((r): r is SubRow => r !== null)
    .sort((a, b) => {
      const ap = NEEDS_REVIEW.has(a.status) ? 0 : 1;
      const bp = NEEDS_REVIEW.has(b.status) ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return (b.submittedAt ?? "").localeCompare(a.submittedAt ?? "");
    });

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold mb-6">Submissions</h1>
      <SubmissionsTable rows={rows} canReassign={["admin", "course_creator"].includes(role)} />
    </div>
  );
}


function EmptyPage({ message }: { message: string }) {
  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-8">Submissions</h1>
      <div className="bg-white border rounded-xl p-12 text-center text-gray-400">{message}</div>
    </div>
  );
}
