import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

export default async function LearnCoursePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: course }, { data: lessons }, { data: progress }] = await Promise.all([
    admin.from("courses").select("*").eq("id", params.id).eq("published", true).single(),
    admin.from("lessons").select("id, title, order").eq("course_id", params.id).order("order"),
    admin.from("progress").select("lesson_id").eq("user_id", user!.id),
  ]);

  if (!course) notFound();

  // Check enrollment — auto-enroll if user already has progress (migration compat)
  const { data: enrollment } = await admin
    .from("enrollments")
    .select("id")
    .eq("user_id", user!.id)
    .eq("course_id", params.id)
    .single();

  if (!enrollment) {
    const hasProgress = (progress ?? []).some((p) =>
      (lessons ?? []).some((l) => l.id === p.lesson_id)
    );
    if (hasProgress) {
      // Auto-enroll legacy users who already have progress
      await admin.from("enrollments").upsert(
        { user_id: user!.id, course_id: params.id },
        { onConflict: "user_id,course_id" }
      );
    } else {
      redirect(`/courses/${params.id}`);
    }
  }

  const completedIds = new Set((progress ?? []).map((p) => p.lesson_id));
  const total = lessons?.length ?? 0;
  const completed = lessons?.filter((l) => completedIds.has(l.id)).length ?? 0;

  return (
    <div className="max-w-2xl">
      <Link href="/learn" className="text-sm text-gray-500 hover:text-gray-700">← My Courses</Link>
      <h1 className="text-2xl font-bold mt-2 mb-1">{course.title}</h1>
      {course.description && <p className="text-gray-500 mb-4">{course.description}</p>}

      {total > 0 && (
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-500 mb-1">
            <span>{completed} of {total} lessons completed</span>
            <span>{Math.round((completed / total) * 100)}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full">
            <div
              className="h-2 bg-brand-600 rounded-full transition-all"
              style={{ width: `${(completed / total) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="mb-6">
        <Link
          href={`/learn/courses/${course.id}/discussions`}
          className="inline-flex items-center gap-2 text-sm border rounded-lg px-4 py-2 hover:bg-gray-50 text-gray-600"
        >
          <span>💬</span> Discussions
        </Link>
      </div>

      <div className="space-y-2">
        {lessons?.map((lesson, i) => {
          const done = completedIds.has(lesson.id);
          return (
            <Link
              key={lesson.id}
              href={`/learn/courses/${course.id}/lessons/${lesson.id}`}
              className="flex items-center gap-3 bg-white border rounded-lg px-4 py-3 hover:shadow-sm transition"
            >
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${done ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {done ? "✓" : i + 1}
              </span>
              <span className="text-sm font-medium">{lesson.title}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
