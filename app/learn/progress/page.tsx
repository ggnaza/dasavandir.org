import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

export default async function ProgressPage() {
  const supabase = createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: courses } = await admin
    .from("courses")
    .select("id, title")
    .eq("published", true);

  const { data: allLessons } = await admin
    .from("lessons")
    .select("id, course_id, title");

  const { data: progress } = await admin
    .from("progress")
    .select("lesson_id")
    .eq("user_id", user!.id);

  const { data: quizResponses } = await admin
    .from("quiz_responses")
    .select("score, submitted_at")
    .eq("user_id", user!.id)
    .order("submitted_at", { ascending: false });

  const completedIds = new Set((progress ?? []).map((p) => p.lesson_id));
  const avgScore = quizResponses?.length
    ? Math.round(quizResponses.reduce((sum, r) => sum + r.score, 0) / quizResponses.length)
    : null;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-8">My Progress</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border rounded-xl p-5">
          <p className="text-sm text-gray-500">Lessons completed</p>
          <p className="text-3xl font-bold mt-1">{completedIds.size}</p>
        </div>
        <div className="bg-white border rounded-xl p-5">
          <p className="text-sm text-gray-500">Quizzes taken</p>
          <p className="text-3xl font-bold mt-1">{quizResponses?.length ?? 0}</p>
        </div>
        {avgScore !== null && (
          <div className="bg-white border rounded-xl p-5">
            <p className="text-sm text-gray-500">Avg. quiz score</p>
            <p className="text-3xl font-bold mt-1">{avgScore}%</p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {courses?.map((course) => {
          const lessons = allLessons?.filter((l) => l.course_id === course.id) ?? [];
          const done = lessons.filter((l) => completedIds.has(l.id)).length;
          const pct = lessons.length ? Math.round((done / lessons.length) * 100) : 0;

          return (
            <div key={course.id} className="bg-white border rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <Link href={`/learn/courses/${course.id}`} className="font-semibold hover:underline">
                  {course.title}
                </Link>
                <span className="text-sm text-gray-500">{done}/{lessons.length} lessons</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full">
                <div
                  className="h-2 bg-brand-600 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
