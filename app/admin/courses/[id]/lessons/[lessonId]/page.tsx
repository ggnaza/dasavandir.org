import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import { LessonEditor } from "./lesson-editor";
import { FileUploader } from "./file-uploader";

export default async function LessonPage({
  params,
}: {
  params: { id: string; lessonId: string };
}) {
  const admin = createAdminClient();
  const [{ data: lesson }, { data: quiz }, { data: files }, { data: assignment }] = await Promise.all([
    admin.from("lessons").select("*").eq("id", params.lessonId).single(),
    admin.from("quizzes").select("id").eq("lesson_id", params.lessonId).single(),
    admin.from("lesson_files").select("id, file_name, storage_path").eq("lesson_id", params.lessonId).order("created_at"),
    admin.from("assignments").select("id").eq("lesson_id", params.lessonId).single(),
  ]);

  if (!lesson) notFound();

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href={`/admin/courses/${params.id}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to course
        </Link>
        <h1 className="text-2xl font-bold mt-2">Edit Lesson</h1>
      </div>

      <LessonEditor lesson={lesson} courseId={params.id} />

      <FileUploader lessonId={params.lessonId} existingFiles={files ?? []} />

      <div className="mt-4 flex gap-3">
        <Link
          href={`/admin/courses/${params.id}/lessons/${params.lessonId}/quiz`}
          className="inline-block text-sm border rounded-lg px-4 py-2 hover:bg-gray-50"
        >
          {quiz ? "Edit quiz →" : "Add quiz →"}
        </Link>
        <Link
          href={`/admin/courses/${params.id}/lessons/${params.lessonId}/assignment`}
          className="inline-block text-sm border rounded-lg px-4 py-2 hover:bg-gray-50"
        >
          {assignment ? "Edit assignment →" : "Add assignment →"}
        </Link>
      </div>
    </div>
  );
}
