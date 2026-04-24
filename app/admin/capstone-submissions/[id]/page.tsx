import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CapstoneReviewer } from "./capstone-reviewer";

export default async function CapstoneSubmissionPage({ params }: { params: { id: string } }) {
  const admin = createAdminClient();

  const { data: submission } = await admin
    .from("capstone_submissions")
    .select(`*, capstones(title, instructions, rubric, course_id, courses(title)), profiles(full_name)`)
    .eq("id", params.id)
    .single();

  if (!submission) notFound();

  const capstone = submission.capstones as any;
  const course = capstone?.courses as any;
  const profile = submission.profiles as any;

  return (
    <div className="max-w-2xl">
      <Link href="/admin/capstone-submissions" className="text-sm text-gray-500 hover:text-gray-700">
        ← Capstone Submissions
      </Link>
      <div className="mt-2 mb-6">
        <h1 className="text-2xl font-bold">{capstone?.title}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {profile?.full_name} · {course?.title}
        </p>
      </div>

      <CapstoneReviewer submission={submission} rubric={capstone?.rubric ?? []} />
    </div>
  );
}
