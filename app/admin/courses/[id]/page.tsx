import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CourseEditor } from "./course-editor";
import { LessonReorderButtons } from "./lesson-reorder-buttons";
import { BackfillDurationsButton } from "./backfill-durations-button";

export default async function CoursePage({ params }: { params: { id: string } }) {
  const admin = createAdminClient();

  const [{ data: course }, { data: lessons }] = await Promise.all([
    admin.from("courses").select("*").eq("id", params.id).single(),
    admin.from("lessons").select("id, title, order").eq("course_id", params.id).order("order"),
  ]);

  if (!course) notFound();

  const { data: creator } = course.created_by
    ? await admin.from("profiles").select("full_name").eq("id", course.created_by).single()
    : { data: null };

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href="/admin/courses" className="text-sm text-gray-500 hover:text-gray-700">← Back to courses</Link>
        <h1 className="text-2xl font-bold mt-2">{course.title}</h1>
        {creator?.full_name && (
          <p className="text-sm text-gray-500 mt-1">Created by <span className="font-medium text-gray-700">{creator.full_name}</span></p>
        )}
      </div>

      <CourseEditor course={course} />

      <div className="mt-6 flex gap-3">
        <Link
          href={`/admin/courses/${course.id}/invitations`}
          className="text-sm border border-gray-300 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50 font-medium"
        >
          Manage invitations
        </Link>
        <Link
          href={`/admin/courses/${course.id}/capstone`}
          className="text-sm border border-purple-300 text-purple-600 px-4 py-2 rounded-lg hover:bg-purple-50 font-medium"
        >
          Capstone project
        </Link>
      </div>

      <BackfillDurationsButton courseId={course.id} />

      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Lessons</h2>
          <Link
            href={`/admin/courses/${course.id}/lessons/new`}
            className="bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 text-sm font-medium"
          >
            + Add Lesson
          </Link>
        </div>

        {!lessons?.length && (
          <p className="text-gray-500 text-sm">No lessons yet. Add your first lesson.</p>
        )}

        <div className="space-y-2">
          {lessons?.map((lesson, i) => (
            <div key={lesson.id} className="bg-white border rounded-lg px-4 py-3 flex items-center gap-3">
              <LessonReorderButtons
                lessonId={lesson.id}
                courseId={course.id}
                isFirst={i === 0}
                isLast={i === (lessons.length - 1)}
              />
              <span className="text-sm flex-1">
                <span className="text-gray-400 mr-2">{i + 1}.</span>
                {lesson.title}
              </span>
              <Link
                href={`/admin/courses/${course.id}/lessons/${lesson.id}`}
                className="text-sm text-brand-600 hover:underline shrink-0"
              >
                Edit
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
