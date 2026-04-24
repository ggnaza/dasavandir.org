import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

export default async function LearnDashboard({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const supabase = createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: courses }, { data: allLessons }, { data: progress }] = await Promise.all([
    admin.from("courses").select("id, title, description").eq("published", true).order("created_at", { ascending: false }),
    admin.from("lessons").select("id, course_id"),
    admin.from("progress").select("lesson_id").eq("user_id", user!.id),
  ]);

  const completedIds = new Set((progress ?? []).map((p) => p.lesson_id));

  const query = searchParams.q?.toLowerCase() ?? "";
  const filtered = (courses ?? []).filter((c) =>
    !query || c.title.toLowerCase().includes(query) || (c.description ?? "").toLowerCase().includes(query)
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Courses</h1>
        <Link href="/learn/progress" className="text-sm text-brand-600 hover:underline">
          View progress →
        </Link>
      </div>

      {/* Search */}
      <form method="GET" className="mb-6">
        <input
          name="q"
          defaultValue={searchParams.q}
          placeholder="Search courses…"
          className="w-full sm:w-72 border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </form>

      {!filtered.length && (
        <p className="text-gray-500">
          {query ? `No courses match "${query}".` : "No courses available yet. Check back soon!"}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((course) => {
          const lessons = (allLessons ?? []).filter((l) => l.course_id === course.id);
          const total = lessons.length;
          const done = lessons.filter((l) => completedIds.has(l.id)).length;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;

          return (
            <Link
              key={course.id}
              href={`/learn/courses/${course.id}`}
              className="bg-white border rounded-xl p-5 hover:shadow-sm transition flex flex-col gap-3"
            >
              <div>
                <h2 className="font-semibold text-lg mb-1">{course.title}</h2>
                {course.description && (
                  <p className="text-sm text-gray-500 line-clamp-2">{course.description}</p>
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
                      className={`h-1.5 rounded-full transition-all ${pct === 100 ? "bg-green-500" : "bg-brand-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
