import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { SubmissionReviewer } from "./submission-reviewer";
import { assertCourseOwner } from "@/lib/assert-course-owner";

export const dynamic = "force-dynamic";

export default async function SubmissionReviewPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const admin = createAdminClient();

  const { data: submission } = await admin
    .from("submissions")
    .select(`
      *,
      profiles(full_name, email),
      assignments(id, title, instructions, rubric, lesson_id,
        lessons(id, title, order, course_id, courses(id, title)))
    `)
    .eq("id", params.id)
    .single();

  if (!submission) notFound();

  const assignment = submission.assignments as any;
  const lesson = assignment?.lessons as any;
  const course = lesson?.courses as any;
  const profile = submission.profiles as any;

  // Verify access — course owner or cohort moderator
  const courseId = course?.id;
  if (!courseId) notFound();

  const accessErr = await assertCourseOwner(courseId, user.id);
  if (accessErr) return accessErr;

  let submissionFileUrl: string | null = null;
  if (submission.file_path) {
    const { data: signed } = await admin.storage
      .from("lesson-files")
      .createSignedUrl(submission.file_path, 3600);
    submissionFileUrl = signed?.signedUrl ?? null;
  }

  return (
    <div className="max-w-7xl">
      {/* Breadcrumb */}
      <div className="mb-5">
        <Link href="/admin/submissions" className="text-sm text-gray-500 hover:text-gray-700">
          ← All submissions
        </Link>
        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-bold">{assignment?.title}</h1>
          <span className="text-gray-300">·</span>
          <span className="text-sm text-gray-500">{profile?.full_name || profile?.email}</span>
          <span className="text-gray-300">·</span>
          <span className="text-sm text-gray-400">{course?.title} → Module {lesson?.order}: {lesson?.title}</span>
        </div>
      </div>

      <SubmissionReviewer
        submission={submission}
        rubric={assignment?.rubric ?? []}
        instructions={assignment?.instructions ?? ""}
        maxScore={assignment?.max_score ?? null}
        fileUrl={submissionFileUrl}
      />
    </div>
  );
}
