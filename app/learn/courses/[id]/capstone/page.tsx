import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { CapstoneSubmitter } from "./capstone-submitter";

export default async function LearnCapstonePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: course }, { data: capstone }, { data: lessons }, { data: progress }] = await Promise.all([
    admin.from("courses").select("id, title").eq("id", params.id).eq("published", true).single(),
    admin.from("capstones").select("*").eq("course_id", params.id).single(),
    admin.from("lessons").select("id").eq("course_id", params.id),
    admin.from("progress").select("lesson_id").eq("user_id", user!.id),
  ]);

  if (!course) notFound();
  if (!capstone) redirect(`/learn/courses/${params.id}`);

  const { data: enrollment } = await admin
    .from("enrollments")
    .select("id")
    .eq("user_id", user!.id)
    .eq("course_id", params.id)
    .single();

  if (!enrollment) redirect(`/courses/${params.id}`);

  const { data: existingSubmission } = await admin
    .from("capstone_submissions")
    .select("*")
    .eq("capstone_id", capstone.id)
    .eq("user_id", user!.id)
    .single();

  const completedIds = new Set((progress ?? []).map((p) => p.lesson_id));
  const allLessonsCompleted =
    (lessons ?? []).length === 0 || (lessons ?? []).every((l) => completedIds.has(l.id));

  return (
    <div className="max-w-2xl">
      <Link href={`/learn/courses/${params.id}`} className="text-sm text-gray-500 hover:text-gray-700">
        ← {course.title}
      </Link>
      <div className="mt-2 mb-2">
        <span className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Capstone Project</span>
        <h1 className="text-2xl font-bold mt-0.5">{capstone.title}</h1>
      </div>

      {capstone.instructions && (
        <div className="bg-white border rounded-xl p-5 mb-6 text-sm text-gray-700 whitespace-pre-wrap">
          {capstone.instructions}
        </div>
      )}

      <CapstoneSubmitter
        capstone={capstone}
        existingSubmission={existingSubmission ?? null}
        courseId={params.id}
        allLessonsCompleted={allLessonsCompleted}
      />
    </div>
  );
}
