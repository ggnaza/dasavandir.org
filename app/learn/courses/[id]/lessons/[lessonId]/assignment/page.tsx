import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AssignmentSubmitter } from "./assignment-submitter";

export default async function LearnAssignmentPage({
  params,
}: {
  params: { id: string; lessonId: string };
}) {
  const supabase = createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: assignment }, { data: course }] = await Promise.all([
    admin.from("assignments").select("*").eq("lesson_id", params.lessonId).single(),
    admin.from("courses").select("pre_submission_ai").eq("id", params.id).single(),
  ]);

  if (!assignment) notFound();

  // ── Group assignment logic ──────────────────────────────────────────────────
  let userGroup: { id: string; name: string; members: { id: string; name: string; email: string }[] } | null = null;
  let groupSubmission: any = null;
  let groupSubmitterName: string | null = null;

  if (assignment.is_group_assignment) {
    // Find which groups in this course the user belongs to
    const { data: allUserMemberships } = await admin
      .from("course_group_members")
      .select("group_id")
      .eq("user_id", user!.id);

    if (allUserMemberships?.length) {
      const memberGroupIds = allUserMemberships.map((m: any) => m.group_id);

      const { data: groupData } = await admin
        .from("course_groups")
        .select("id, name")
        .eq("course_id", params.id)
        .in("id", memberGroupIds)
        .maybeSingle();

      if (groupData) {
        const { data: members } = await admin
          .from("course_group_members")
          .select("user_id, profiles(full_name, email)")
          .eq("group_id", groupData.id);

        userGroup = {
          id: groupData.id,
          name: groupData.name,
          members: (members ?? []).map((m: any) => ({
            id: m.user_id,
            name: m.profiles?.full_name || m.profiles?.email || "Unknown",
            email: m.profiles?.email || "",
          })),
        };

        // Find the group's current submission (if any) — used when another member submitted
        const { data: gSub } = await admin
          .from("submissions")
          .select("*, profiles(full_name, email)")
          .eq("assignment_id", assignment.id)
          .eq("group_id", groupData.id)
          .order("submitted_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (gSub) {
          groupSubmission = gSub;
          const sp = gSub.profiles as any;
          groupSubmitterName = sp?.full_name || sp?.email || "A group member";
        }
      }
    }
  }

  // ── Individual/own submission lookup ───────────────────────────────────────
  // For group assignments after approval fan-out, the user has their own row.
  // For individual assignments, this is the primary submission.
  const { data: ownSubmission } = await admin
    .from("submissions")
    .select("*")
    .eq("assignment_id", assignment.id)
    .eq("user_id", user!.id)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Active submission priority:
  // 1. Own row (fan-out copy after scoring, or own submit)
  // 2. Group's submission row (another member submitted, awaiting review)
  const activeSubmission = ownSubmission ?? (assignment.is_group_assignment ? groupSubmission : null);

  // Only set groupSubmitterName when showing a submission from another group member
  const displaySubmitterName =
    assignment.is_group_assignment &&
    activeSubmission &&
    activeSubmission === groupSubmission &&
    groupSubmission?.user_id !== user!.id
      ? groupSubmitterName
      : null;

  let existingFileUrl: string | null = null;
  if (activeSubmission?.file_path) {
    const { data: signed } = await admin.storage
      .from("lesson-files")
      .createSignedUrl(activeSubmission.file_path, 3600);
    existingFileUrl = signed?.signedUrl ?? null;
  }

  return (
    <div className="max-w-2xl">
      <Link
        href={`/learn/courses/${params.id}/lessons/${params.lessonId}`}
        className="text-sm text-gray-500 hover:text-gray-700"
      >
        ← Back to lesson
      </Link>
      <h1 className="text-2xl font-bold mt-2 mb-1">{assignment.title}</h1>

      {assignment.instructions && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 text-sm text-blue-800 whitespace-pre-wrap leading-relaxed">
          {assignment.instructions}
        </div>
      )}

      <AssignmentSubmitter
        assignment={assignment}
        existingSubmission={activeSubmission}
        existingFileUrl={existingFileUrl}
        courseId={params.id}
        lessonId={params.lessonId}
        preSubmissionAiEnabled={course?.pre_submission_ai ?? false}
        isGroupAssignment={assignment.is_group_assignment ?? false}
        group={userGroup}
        groupSubmitterName={displaySubmitterName}
      />
    </div>
  );
}
