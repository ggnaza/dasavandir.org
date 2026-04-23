import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function LearnDashboard() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: courses } = await supabase
    .from("courses")
    .select("id, title, description")
    .eq("published", true)
    .order("created_at", { ascending: false });

  // Get lessons completed by this user
  const { data: progress } = await supabase
    .from("progress")
    .select("lesson_id")
    .eq("user_id", user!.id);

  const completedIds = new Set((progress ?? []).map((p) => p.lesson_id));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-8">My Courses</h1>

      {!courses?.length && (
        <p className="text-gray-500">No courses available yet. Check back soon!</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses?.map((course) => (
          <Link
            key={course.id}
            href={`/learn/courses/${course.id}`}
            className="bg-white border rounded-xl p-5 hover:shadow-sm transition"
          >
            <h2 className="font-semibold text-lg mb-1">{course.title}</h2>
            {course.description && (
              <p className="text-sm text-gray-500 line-clamp-2">{course.description}</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
