import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SubmissionReviewer } from "./submission-reviewer";

export default async function SubmissionReviewPage({ params }: { params: { id: string } }) {
  const admin = createAdminClient();

  const { data: submission } = await admin
    .from("submissions")
    .select(`
      *, profiles(full_name),
      assignments(title, instructions, rubric, lesson_id,
        lessons(title, course_id, courses(title)))
    `)
    .eq("id", params.id)
    .single();

  if (!submission) notFound();

  const assignment = submission.assignments as any;
  const lesson = assignment?.lessons as any;
  const course = lesson?.courses as any;
  const profile = submission.profiles as any;

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link href="/admin/submissions" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to submissions
        </Link>
        <h1 className="text-2xl font-bold mt-2">{assignment?.title}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {profile?.full_name} · {course?.title} → {lesson?.title}
        </p>
      </div>

      <SubmissionReviewer submission={submission} rubric={assignment?.rubric ?? []} />
    </div>
  );
}
