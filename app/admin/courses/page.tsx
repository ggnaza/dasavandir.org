import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

export default async function CoursesPage() {
  const admin = createAdminClient();
  const { data: courses } = await admin
    .from("courses")
    .select("id, title, description, published, created_at")
    .order("created_at", { ascending: false });

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
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold">{course.title}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full ${course.published ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {course.published ? "Published" : "Draft"}
                </span>
              </div>
              {course.description && (
                <p className="text-sm text-gray-500 mt-0.5">{course.description}</p>
              )}
            </div>
            <Link
              href={`/admin/courses/${course.id}`}
              className="text-sm text-brand-600 hover:underline ml-4 shrink-0"
            >
              Edit →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
