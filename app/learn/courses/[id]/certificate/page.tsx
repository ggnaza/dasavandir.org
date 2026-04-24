import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { PrintButton } from "./print-button";

export default async function CertificatePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: course }, { data: lessons }, { data: profile }, { data: progress }] = await Promise.all([
    admin.from("courses").select("id, title, description").eq("id", params.id).eq("published", true).single(),
    admin.from("lessons").select("id").eq("course_id", params.id),
    admin.from("profiles").select("full_name").eq("id", user!.id).single(),
    admin.from("progress").select("lesson_id, completed_at").eq("user_id", user!.id),
  ]);

  if (!course) notFound();

  const completedIds = new Set((progress ?? []).map((p) => p.lesson_id));
  const totalLessons = lessons?.length ?? 0;
  const allDone = totalLessons > 0 && (lessons ?? []).every((l) => completedIds.has(l.id));

  if (!allDone) {
    redirect(`/learn/courses/${params.id}`);
  }

  // Find the latest completion date
  const completionDates = (progress ?? [])
    .filter((p) => (lessons ?? []).some((l) => l.id === p.lesson_id))
    .map((p) => new Date(p.completed_at));
  const completedAt = completionDates.length
    ? new Date(Math.max(...completionDates.map((d) => d.getTime())))
    : new Date();

  const formattedDate = completedAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const learnerName = profile?.full_name ?? "Learner";

  return (
    <div className="flex flex-col items-center">
      <div className="flex gap-4 mb-8 no-print">
        <Link href={`/learn/courses/${params.id}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to course
        </Link>
        <PrintButton />
      </div>

      {/* Certificate */}
      <div
        id="certificate"
        className="w-full max-w-2xl bg-white border-8 border-brand-600 rounded-2xl p-12 text-center shadow-lg print:shadow-none print:border-8"
      >
        <div className="text-brand-600 text-5xl mb-4">🏆</div>
        <p className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-2">
          Certificate of Completion
        </p>
        <p className="text-gray-600 mb-6">This certifies that</p>

        <h1 className="text-4xl font-bold text-gray-900 mb-6 font-serif">
          {learnerName}
        </h1>

        <p className="text-gray-600 mb-2">has successfully completed the course</p>

        <h2 className="text-2xl font-bold text-brand-700 mb-8">
          {course.title}
        </h2>

        {course.description && (
          <p className="text-gray-500 text-sm mb-8 max-w-md mx-auto italic">
            {course.description}
          </p>
        )}

        <div className="border-t pt-6 mt-4">
          <p className="text-sm text-gray-400">Completed on</p>
          <p className="text-lg font-semibold text-gray-700">{formattedDate}</p>
        </div>

        <div className="mt-8 text-xs text-gray-300 tracking-wide uppercase">
          Dasavandir.org
        </div>
      </div>
    </div>
  );
}
