import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { EnrollButton } from "./enroll-button";
import { ModuleList } from "./module-list";

export const dynamic = "force-dynamic";

export default async function CourseDetailPage({ params }: { params: { id: string } }) {
  const admin = createAdminClient();
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: course }, { data: lessons }] = await Promise.all([
    admin.from("courses").select("*").eq("id", params.id).eq("published", true).single(),
    admin
      .from("lessons")
      .select("id, title, order, what_you_learn, skills")
      .eq("course_id", params.id)
      .order("order"),
  ]);

  if (!course) notFound();

  let isEnrolled = false;
  if (user) {
    const { data: enrollment } = await admin
      .from("enrollments")
      .select("id")
      .eq("user_id", user.id)
      .eq("course_id", params.id)
      .single();
    isEnrolled = !!enrollment;
  }

  const lessonCount = lessons?.length ?? 0;
  const outcomes: string[] = course.outcomes ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold" style={{ color: "#EC5328" }}>Dasavandir</Link>
          <div className="flex gap-3 text-sm items-center">
            <Link href={user ? "/learn" : "/courses"} className="text-gray-600 hover:text-gray-900">← All courses</Link>
            {!user && (
              <Link href="/auth/signup" className="text-white px-4 py-1.5 rounded-lg font-medium" style={{ backgroundColor: "#EC5328" }}>
                Get started
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10 lg:flex lg:gap-10 lg:items-start">

        {/* Main content */}
        <div className="flex-1 min-w-0">

          {/* Hero */}
          <div className="bg-white rounded-2xl border overflow-hidden mb-6">
            {course.cover_image_url ? (
              <img src={course.cover_image_url} alt={course.title} className="w-full h-56 object-cover" />
            ) : (
              <div className="w-full h-56 flex items-center justify-center text-6xl" style={{ backgroundColor: "#323131" }}>🎓</div>
            )}
            <div className="p-8">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {course.category && (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">{course.category}</span>
                )}
                {course.is_paid ? (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-100 text-orange-700">
                    {course.price_amd ? `${course.price_amd.toLocaleString()} ֏` : "Paid"}
                  </span>
                ) : (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">Free</span>
                )}
                {course.language && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-600">
                    {course.language === "hy" ? "Հայերեն" : "English"}
                  </span>
                )}
              </div>

              <h1 className="text-3xl font-bold text-gray-900 mb-4">{course.title}</h1>

              {course.description && (
                <p className="text-gray-600 leading-relaxed mb-5">{course.description}</p>
              )}

              <div className="flex flex-wrap gap-5 text-sm text-gray-500">
                {lessonCount > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span>📚</span> {lessonCount} module{lessonCount !== 1 ? "s" : ""}
                  </span>
                )}
                {course.hours_to_complete && (
                  <span className="flex items-center gap-1.5">
                    <span>⏱</span> {course.hours_to_complete} hour{course.hours_to_complete !== 1 ? "s" : ""} to complete
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Outcomes */}
          {outcomes.length > 0 && (
            <div className="bg-white rounded-2xl border p-6 mb-6">
              <h2 className="font-bold text-gray-900 mb-4">What you'll achieve</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {outcomes.map((outcome, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="text-green-500 font-bold text-sm mt-0.5 shrink-0">✓</span>
                    <span className="text-sm text-gray-700">{outcome}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Modules (expandable) */}
          {lessons && lessons.length > 0 && (
            <div className="bg-white rounded-2xl border overflow-hidden mb-6">
              <div className="px-6 py-4 border-b">
                <h2 className="font-bold text-gray-900">Course modules</h2>
                <p className="text-sm text-gray-500 mt-0.5">{lessonCount} module{lessonCount !== 1 ? "s" : ""}</p>
              </div>
              <ModuleList lessons={lessons} />
            </div>
          )}
        </div>

        {/* Sticky CTA sidebar */}
        <aside className="w-full lg:w-80 shrink-0 lg:sticky lg:top-24 mt-6 lg:mt-0">
          <div className="bg-white rounded-2xl border p-6 shadow-sm">
            <div className="text-center mb-4">
              {course.is_paid ? (
                <p className="text-2xl font-bold text-gray-900">
                  {course.price_amd ? `${course.price_amd.toLocaleString()} ֏` : "Paid"}
                </p>
              ) : (
                <p className="text-2xl font-bold text-green-600">Free</p>
              )}
            </div>

            {user ? (
              isEnrolled ? (
                <Link
                  href={`/learn/courses/${course.id}`}
                  className="block w-full text-center text-white px-6 py-3 rounded-xl font-semibold text-sm"
                  style={{ backgroundColor: "#EC5328" }}
                >
                  Continue learning →
                </Link>
              ) : (
                <EnrollButton courseId={course.id} isPaid={!!course.is_paid} />
              )
            ) : (
              <div className="space-y-2">
                <Link
                  href="/"
                  className="block w-full text-center text-white px-6 py-3 rounded-xl font-semibold text-sm"
                  style={{ backgroundColor: "#EC5328" }}
                >
                  {course.is_paid ? "Enroll now" : "Start for free"} →
                </Link>
                <p className="text-center text-xs text-gray-400">Sign in or create an account to enroll</p>
              </div>
            )}

            <div className="mt-4 pt-4 border-t space-y-2.5 text-sm text-gray-600">
              {lessonCount > 0 && (
                <div className="flex items-center gap-2">
                  <span>📚</span> <span>{lessonCount} module{lessonCount !== 1 ? "s" : ""}</span>
                </div>
              )}
              {course.hours_to_complete && (
                <div className="flex items-center gap-2">
                  <span>⏱</span> <span>{course.hours_to_complete}h to complete</span>
                </div>
              )}
              {course.language && (
                <div className="flex items-center gap-2">
                  <span>🌐</span>
                  <span>{course.language === "hy" ? "Armenian" : "English"}</span>
                </div>
              )}
              {course.category && (
                <div className="flex items-center gap-2">
                  <span>📁</span> <span>{course.category}</span>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
