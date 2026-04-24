import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CourseDetailPage({ params }: { params: { id: string } }) {
  const admin = createAdminClient();
  const supabase = createClient();

  const [{ data: course }, { data: lessons }, { data: { user } }] = await Promise.all([
    admin.from("courses").select("*").eq("id", params.id).eq("published", true).single(),
    admin.from("lessons").select("id, title, order").eq("course_id", params.id).order("order"),
    supabase.auth.getUser(),
  ]);

  if (!course) notFound();

  const lessonCount = lessons?.length ?? 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold" style={{ color: "#EC5328" }}>Dasavandir</Link>
          <div className="flex gap-3 text-sm">
            <Link href="/courses" className="text-gray-600 hover:text-gray-900 font-medium">← All courses</Link>
            {!user && (
              <>
                <Link href="/auth/login" className="text-gray-600 hover:text-gray-900 font-medium">Sign in</Link>
                <Link href="/auth/signup" className="text-white px-4 py-1.5 rounded-lg font-medium" style={{ backgroundColor: "#EC5328" }}>
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-white rounded-2xl border overflow-hidden">
          {/* Cover image */}
          {course.cover_image_url ? (
            <img src={course.cover_image_url} alt={course.title} className="w-full h-56 object-cover" />
          ) : (
            <div className="w-full h-56 flex items-center justify-center text-6xl" style={{ backgroundColor: "#323131" }}>
              🎓
            </div>
          )}

          <div className="p-8">
            {/* Price badge */}
            <div className="mb-4">
              {course.is_paid ? (
                <span className="text-sm font-semibold px-3 py-1 rounded-full bg-orange-100 text-orange-700">
                  {course.price_amd ? `${course.price_amd.toLocaleString()} AMD` : "Paid"}
                </span>
              ) : (
                <span className="text-sm font-semibold px-3 py-1 rounded-full bg-green-100 text-green-700">
                  Free
                </span>
              )}
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-3">{course.title}</h1>

            {course.description && (
              <p className="text-gray-600 leading-relaxed mb-6">{course.description}</p>
            )}

            {/* Lesson count */}
            {lessonCount > 0 && (
              <p className="text-sm text-gray-500 mb-6">
                {lessonCount} lesson{lessonCount !== 1 ? "s" : ""}
              </p>
            )}

            {/* Lesson preview */}
            {lessons && lessons.length > 0 && (
              <div className="mb-8">
                <h2 className="font-semibold text-gray-900 mb-3">What you'll learn</h2>
                <div className="space-y-2">
                  {lessons.slice(0, 5).map((lesson, i) => (
                    <div key={lesson.id} className="flex items-center gap-3 text-sm text-gray-600">
                      <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-400 shrink-0">
                        {i + 1}
                      </span>
                      {lesson.title}
                    </div>
                  ))}
                  {lessons.length > 5 && (
                    <p className="text-sm text-gray-400 pl-8">+{lessons.length - 5} more lessons</p>
                  )}
                </div>
              </div>
            )}

            {/* CTA */}
            {user ? (
              <Link
                href={`/learn/courses/${course.id}`}
                className="inline-block text-white px-8 py-3 rounded-xl font-semibold text-sm"
                style={{ backgroundColor: "#EC5328" }}
              >
                Go to course →
              </Link>
            ) : (
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/auth/signup?next=/learn/courses/${course.id}`}
                  className="inline-block text-white px-8 py-3 rounded-xl font-semibold text-sm"
                  style={{ backgroundColor: "#EC5328" }}
                >
                  {course.is_paid ? "Enroll now" : "Start for free"} →
                </Link>
                <Link
                  href={`/auth/login?next=/learn/courses/${course.id}`}
                  className="inline-block border border-gray-300 text-gray-700 px-8 py-3 rounded-xl font-semibold text-sm hover:bg-gray-50"
                >
                  Sign in
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
