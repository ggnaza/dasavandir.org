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

  const { data: assignment } = await admin
    .from("assignments")
    .select("*")
    .eq("lesson_id", params.lessonId)
    .single();

  if (!assignment) notFound();

  const [{ data: submission }, { data: course }] = await Promise.all([
    admin
      .from("submissions")
      .select("*")
      .eq("assignment_id", assignment.id)
      .eq("user_id", user!.id)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .single(),
    admin.from("courses").select("pre_submission_ai").eq("id", params.id).single(),
  ]);

  return (
    <div className="max-w-2xl">
      <Link href={`/learn/courses/${params.id}/lessons/${params.lessonId}`} className="text-sm text-gray-500 hover:text-gray-700">
        ← Back to lesson
      </Link>
      <h1 className="text-2xl font-bold mt-2 mb-1">{assignment.title}</h1>

      {assignment.instructions && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 text-sm text-blue-800">
          {assignment.instructions}
        </div>
      )}

      <AssignmentSubmitter
        assignment={assignment}
        existingSubmission={submission}
        courseId={params.id}
        lessonId={params.lessonId}
        preSubmissionAiEnabled={course?.pre_submission_ai ?? false}
      />
    </div>
  );
}
