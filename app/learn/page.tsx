import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function LearnDashboard() {
  const supabase = createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Process pending invitations → auto-enroll
  const userEmail = user!.email?.toLowerCase();
  if (userEmail) {
    const { data: pendingInvites } = await admin
      .from("invitations")
      .select("id, course_id")
      .eq("email", userEmail)
      .eq("status", "pending");

    if (pendingInvites && pendingInvites.length > 0) {
      await Promise.all(
        pendingInvites.map((inv) =>
          Promise.all([
            admin.from("enrollments").upsert(
              { user_id: user!.id, course_id: inv.course_id },
              { onConflict: "user_id,course_id" }
            ),
            admin.from("invitations").update({ status: "accepted" }).eq("id", inv.id),
          ])
        )
      );
    }
  }

  const { data: enrollments } = await admin
    .from("enrollments")
    .select("course_id")
    .eq("user_id", user!.id);

  const enrolledIds = new Set((enrollments ?? []).map((e) => e.course_id));

  const [{ data: allCourses }, { data: allLessons }, { data: progress }] = await Promise.all([
    admin
      .from("courses")
      .select("id, title, description, cover_image_url, is_paid, price_amd, category, hours_to_complete, language")
      .eq("published", true)
      .order("created_at", { ascending: false }),
    admin.from("lessons").select("id, course_id"),
    admin.from("progress").select("lesson_id").eq("user_id", user!.id),
  ]);

  const completedIds = new Set((progress ?? []).map((p) => p.lesson_id));
  const courses = allCourses ?? [];

  const enrolledCourses = courses.filter((c) => enrolledIds.has(c.id));
  const availableCourses = courses.filter((c) => !enrolledIds.has(c.id));

  // Group available courses by category
  const byCategory: Record<string, typeof courses> = {};
  for (const course of availableCourses) {
    const cat = course.category || "Other";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(course);
  }
  const categories = Object.keys(byCategory).sort();

  function progressFor(courseId: string) {
    const lessons = (allLessons ?? []).filter((l) => l.course_id === courseId);
    const total = lessons.length;
    const done = lessons.filter((l) => completedIds.has(l.id)).length;
    return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  }

  return (
    <div className="max-w-6xl mx-auto">

      {/* Enrolled courses */}
      {enrolledCourses.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-bold mb-4">My Courses</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {enrolledCourses.map((course) => {
              const { total, done, pct } = progressFor(course.id);
              return (
                <Link
                  key={course.id}
                  href={`/learn/courses/${course.id}`}
                  className="bg-white border rounded-xl overflow-hidden hover:shadow-sm transition flex flex-col"
                >
                  {course.cover_image_url ? (
                    <img src={course.cover_image_url} alt={course.title} className="w-full h-32 object-cover" />
                  ) : (
                    <div className="w-full h-32 flex items-center justify-center text-4xl" style={{ backgroundColor: "#323131" }}>🎓</div>
                  )}
                  <div className="p-4 flex flex-col flex-1 gap-3">
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm leading-snug mb-1">{course.title}</h3>
                      {course.description && (
                        <p className="text-xs text-gray-500 line-clamp-2">{course.description}</p>
                      )}
                    </div>
                    {total > 0 && (
                      <div>
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                          <span>{done}/{total} lessons</span>
                          {pct === 100 && <span className="text-green-600 font-medium">Complete ✓</span>}
                          {pct > 0 && pct < 100 && <span>{pct}%</span>}
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full">
                          <div
                            className={`h-1.5 rounded-full ${pct === 100 ? "bg-green-500" : "bg-brand-500"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Browse all courses by category */}
      {availableCourses.length > 0 && (
        <section>
          <h2 className="text-lg font-bold mb-1">Browse All Courses</h2>
          <p className="text-sm text-gray-500 mb-6">Click any course to see details and enroll.</p>

          {categories.map((cat) => (
            <div key={cat} className="mb-8">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{cat}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {byCategory[cat].map((course) => (
                  <Link
                    key={course.id}
                    href={`/courses/${course.id}`}
                    className="bg-white border rounded-xl overflow-hidden hover:shadow-sm transition flex flex-col"
                  >
                    {course.cover_image_url ? (
                      <img src={course.cover_image_url} alt={course.title} className="w-full h-32 object-cover" />
                    ) : (
                      <div className="w-full h-32 flex items-center justify-center text-4xl" style={{ backgroundColor: "#323131" }}>🎓</div>
                    )}
                    <div className="p-4 flex flex-col flex-1">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 text-sm leading-snug">{course.title}</h3>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {course.is_paid ? (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                              {course.price_amd ? `${course.price_amd.toLocaleString()} ֏` : "Paid"}
                            </span>
                          ) : (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Free</span>
                          )}
                        </div>
                      </div>
                      {course.description && (
                        <p className="text-xs text-gray-500 line-clamp-2 mb-2">{course.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-auto text-xs text-gray-400">
                        {course.hours_to_complete && <span>⏱ {course.hours_to_complete}h</span>}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {enrolledCourses.length === 0 && availableCourses.length === 0 && (
        <div className="text-center py-16">
          <p className="text-gray-500">No courses available yet.</p>
        </div>
      )}
    </div>
  );
}
