import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CourseEditor } from "./course-editor";
import { CourseResources } from "./course-resources";
import { CourseReminders } from "./course-reminders";
import { LessonReorderButtons } from "./lesson-reorder-buttons";
import { BackfillDurationsButton } from "./backfill-durations-button";

export const dynamic = "force-dynamic";

export default async function CoursePage({ params }: { params: { id: string } }) {
  const admin = createAdminClient();

  const [{ data: course }, { data: lessons }, { data: enrollments }] = await Promise.all([
    admin.from("courses").select("*").eq("id", params.id).single(),
    admin.from("lessons").select("id, title, order, deadline_date").eq("course_id", params.id).order("order"),
    admin.from("enrollments").select("user_id").eq("course_id", params.id),
  ]);

  if (!course) notFound();

  const { data: creator } = course.created_by
    ? await admin.from("profiles").select("full_name").eq("id", course.created_by).single()
    : { data: null };

  const enrolledCount = enrollments?.length ?? 0;
  const lessonCount = lessons?.length ?? 0;

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href="/admin/courses" className="text-sm text-gray-500 hover:text-gray-700">← Back to courses</Link>
        <h1 className="text-2xl font-bold mt-2">{course.title}</h1>
        {creator?.full_name && (
          <p className="text-sm text-gray-500 mt-1">Created by <span className="font-medium text-gray-700">{creator.full_name}</span></p>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold">{enrolledCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Students</p>
        </div>
        <div className="bg-white border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold">{lessonCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Lessons</p>
        </div>
        <Link href={`/admin/courses/${course.id}/gradebook`} className="bg-brand-50 border border-brand-200 rounded-xl p-4 text-center hover:bg-brand-100 transition-colors">
          <p className="text-2xl font-bold text-brand-700">→</p>
          <p className="text-xs text-brand-600 font-medium mt-0.5">Gradebook</p>
        </Link>
      </div>

      <CourseEditor course={course} lessonDeadlineDates={(lessons ?? []).map(l => ({ title: l.title, deadline_date: l.deadline_date ?? null }))} />

      <div className="mt-4">
        <CourseResources courseId={course.id} />
      </div>

      <CourseReminders
        courseId={course.id}
        initialNotifyOnNewLesson={course.notify_on_new_lesson ?? false}
        initialNotStartedDays={course.remind_not_started_days ?? null}
        initialNotCompletedDays={course.remind_not_completed_days ?? null}
      />

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
