import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { DeleteCourseButton } from "./delete-course-button";

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const admin = createAdminClient();
  const { data: courses } = await admin
    .from("courses")
    .select("id, title, description, published, created_at, created_by")
    .order("created_at", { ascending: false });

  const enrollmentCounts: Record<string, number> = {};
  const creatorNames: Record<string, string> = {};

  if (courses?.length) {
    const [{ data: enrollments }, { data: profiles }] = await Promise.all([
      admin.from("enrollments").select("course_id").in("course_id", courses.map((c) => c.id)),
      admin.from("profiles").select("id, full_name").in("id", courses.map((c) => c.created_by).filter(Boolean)),
    ]);
    for (const e of enrollments ?? []) {
      enrollmentCounts[e.course_id] = (enrollmentCounts[e.course_id] ?? 0) + 1;
    }
    for (const p of profiles ?? []) {
      creatorNames[p.id] = p.full_name;
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Courses</h1>
        <Link
          href="/admin/courses/new"
          className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 text-sm font-medium"
        >
          + New Course
        </Link>
      </div>

      {!courses?.length && (
        <div className="bg-white border rounded-xl p-10 text-center text-gray-500">
          No courses yet.{" "}
          <Link href="/admin/courses/new" className="text-brand-600 hover:underline">
            Create your first course →
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {courses?.map((course) => (
          <div key={course.id} className="bg-white border rounded-xl p-5 flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href={`/admin/courses/${course.id}/learners`}
                  className="font-semibold hover:text-brand-600 hover:underline"
                >
                  {course.title}
                </Link>
                <span className={`text-xs px-2 py-0.5 rounded-full ${course.published ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {course.published ? "Published" : "Draft"}
                </span>
                <span className="text-xs text-gray-400">
                  {enrollmentCounts[course.id] ?? 0} enrolled
                </span>
              </div>
              {course.description && (
                <p className="text-sm text-gray-500 mt-0.5 truncate">{course.description}</p>
              )}
              {creatorNames[course.created_by] && (
                <p className="text-xs text-gray-400 mt-0.5">by {creatorNames[course.created_by]}</p>
              )}
            </div>
            <div className="flex items-center ml-4 shrink-0">
              <Link
                href={`/admin/courses/${course.id}`}
                className="text-sm text-brand-600 hover:underline"
              >
                Edit →
              </Link>
              <DeleteCourseButton courseId={course.id} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
