import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import { LearnerRows } from "./learner-rows";


export const dynamic = "force-dynamic";

export default async function CourseLearnerPage({ params }: { params: { id: string } }) {
  const admin = createAdminClient();

  const [{ data: course }, { data: lessons }, { data: enrollments }] = await Promise.all([
    admin.from("courses").select("id, title").eq("id", params.id).single(),
    admin.from("lessons").select("id, title, order").eq("course_id", params.id).order("order"),
    admin
      .from("enrollments")
      .select("user_id, enrolled_at")
      .eq("course_id", params.id)
      .order("enrolled_at", { ascending: false }),
  ]);

  if (!course) notFound();

  const userIds = (enrollments ?? []).map((e) => e.user_id);

  const [{ data: profiles }, { data: allProgress }] = await Promise.all([
    userIds.length > 0
      ? admin.from("profiles").select("id, full_name, email").in("id", userIds)
      : Promise.resolve({ data: [] }),
    userIds.length > 0
      ? admin.from("progress").select("user_id, lesson_id").in("user_id", userIds)
      : Promise.resolve({ data: [] }),
  ]);

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

  const lessonList = lessons ?? [];
  const totalLessons = lessonList.length;

  const learners = (enrollments ?? []).map((e) => {
    const profile = profileMap[e.user_id];
    const name = profile?.full_name || profile?.email || "Unknown";
    const email = profile?.email ?? "";
    const completedIds = new Set(
      (allProgress ?? []).filter((p) => p.user_id === e.user_id).map((p) => p.lesson_id)
    );
    const completedCount = lessonList.filter((l) => completedIds.has(l.id)).length;
    const pct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

    return {
      userId: e.user_id,
      name,
      email,
      enrolledAt: e.enrolled_at,
      completedCount,
      totalLessons,
      pct,
      completedIds: Array.from(completedIds),
    };
  });

  const avgPct = learners.length > 0
    ? Math.round(learners.reduce((sum, l) => sum + l.pct, 0) / learners.length)
    : 0;

  const completedAll = learners.filter((l) => l.pct === 100).length;

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <Link href="/admin/courses" className="text-sm text-gray-500 hover:text-gray-700">← Back to courses</Link>
        <div className="flex items-center justify-between mt-2">
          <h1 className="text-2xl font-bold">{course.title}</h1>
          <Link
            href={`/admin/courses/${course.id}`}
            className="text-sm border rounded-lg px-4 py-2 hover:bg-gray-50 text-gray-600"
          >
            Edit course →
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border rounded-xl p-5">
          <p className="text-sm text-gray-500">Enrolled</p>
          <p className="text-3xl font-bold mt-1">{learners.length}</p>
        </div>
        <div className="bg-white border rounded-xl p-5">
          <p className="text-sm text-gray-500">Avg. progress</p>
          <p className="text-3xl font-bold mt-1">{avgPct}%</p>
        </div>
        <div className="bg-white border rounded-xl p-5">
          <p className="text-sm text-gray-500">Completed</p>
          <p className="text-3xl font-bold mt-1">{completedAll}</p>
        </div>
      </div>

      {/* Learner list */}
      {learners.length === 0 ? (
        <div className="bg-white border rounded-xl p-10 text-center text-gray-500">
          No learners enrolled yet.
        </div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50 grid grid-cols-12 gap-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <span className="col-span-4">Learner</span>
            <span className="col-span-5">Progress</span>
            <span className="col-span-2 text-right">Enrolled</span>
            <span className="col-span-1" />
          </div>
          <LearnerRows learners={learners} lessons={lessonList} />
        </div>
      )}
    </div>
  );
}
